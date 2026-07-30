package db

import (
	"errors"
	"fmt"
	"sync"

	"github.com/go-xorm/xorm"
	_ "github.com/mattn/go-sqlite3"
)

var engine *xorm.Engine
var engineMutex sync.RWMutex

func Open(dataSourceName string, showSQL bool) error {
	newEngine, err := xorm.NewEngine("sqlite3", dataSourceName)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	if dataSourceName == ":memory:" || dataSourceName == "file:gofi-test?mode=memory&cache=shared" {
		newEngine.SetMaxOpenConns(1)
	}
	newEngine.ShowSQL(showSQL)

	if err := Migrate(newEngine); err != nil {
		_ = newEngine.Close()
		return err
	}

	engineMutex.Lock()
	oldEngine := engine
	engine = newEngine
	engineMutex.Unlock()
	if oldEngine != nil {
		_ = oldEngine.Close()
	}

	if err := SyncGuestPermissions(); err != nil {
		return fmt.Errorf("seed guest permissions: %w", err)
	}
	return nil
}

func Migrate(target *xorm.Engine) error {
	if target == nil {
		return errors.New("database engine is nil")
	}
	if err := target.Sync2(new(Configuration), new(User), new(Permission)); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}

func Close() error {
	engineMutex.Lock()
	defer engineMutex.Unlock()
	if engine == nil {
		return nil
	}
	err := engine.Close()
	engine = nil
	return err
}

// Engine 获取数据库引擎实例
func Engine() *xorm.Engine {
	engineMutex.RLock()
	defer engineMutex.RUnlock()
	return engine
}
