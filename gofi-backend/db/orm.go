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
	if err := target.Sync2(
		new(Configuration),
		new(User),
		new(Permission),
		new(FileIndex),
		new(Share),
		new(SchemaMigration),
	); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	migration := &SchemaMigration{ID: 1}
	found, err := target.ID(1).Get(migration)
	if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	if found && migration.Version > CurrentSchemaVersion {
		return fmt.Errorf("database schema %d is newer than supported schema %d", migration.Version, CurrentSchemaVersion)
	}
	migration.Version = CurrentSchemaVersion
	if found {
		if _, err := target.ID(1).Cols("version").Update(migration); err != nil {
			return fmt.Errorf("update schema version: %w", err)
		}
	} else if _, err := target.InsertOne(migration); err != nil {
		return fmt.Errorf("create schema version: %w", err)
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
