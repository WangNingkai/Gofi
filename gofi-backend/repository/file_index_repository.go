package repository

import (
	"fmt"
	"strings"

	"gofi/db"

	"xorm.io/xorm"
)

const fileIndexInsertBatchSize = 500

type FileIndexProducer func(yield func(db.FileIndex) error) error

type FileIndexRepository interface {
	ReplaceAll(produce FileIndexProducer) error
	ReplacePrefix(prefix string, produce FileIndexProducer) error
	Search(query string, includeContent bool, limit int) ([]db.FileIndex, error)
}

type fileIndexRepository struct {
	engine *xorm.Engine
}

func NewFileIndexRepository(engine *xorm.Engine) FileIndexRepository {
	return &fileIndexRepository{engine: engine}
}

func (repository *fileIndexRepository) ReplaceAll(produce FileIndexProducer) error {
	session := repository.engine.NewSession()
	closed := false
	defer func() {
		if !closed {
			_ = session.Close()
		}
	}()
	if err := session.Begin(); err != nil {
		return err
	}
	if _, err := session.Where("1 = 1").Delete(new(db.FileIndex)); err != nil {
		_ = session.Rollback()
		return err
	}
	if err := produceFileIndexEntries(session, produce); err != nil {
		_ = session.Rollback()
		return err
	}
	if err := session.Commit(); err != nil {
		return err
	}
	if err := session.Close(); err != nil {
		return err
	}
	closed = true
	if _, err := repository.engine.Exec("PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		return fmt.Errorf("checkpoint file index WAL: %w", err)
	}
	return nil
}

func (repository *fileIndexRepository) ReplacePrefix(prefix string, produce FileIndexProducer) error {
	session := repository.engine.NewSession()
	defer session.Close()
	if err := session.Begin(); err != nil {
		return err
	}
	escaped := escapeLike(strings.TrimSuffix(prefix, "/"))
	if _, err := session.Where("path = ? OR path LIKE ? ESCAPE '\\'", prefix, escaped+"/%").Delete(new(db.FileIndex)); err != nil {
		_ = session.Rollback()
		return err
	}
	if err := produceFileIndexEntries(session, produce); err != nil {
		_ = session.Rollback()
		return err
	}
	return session.Commit()
}

func produceFileIndexEntries(session *xorm.Session, produce FileIndexProducer) error {
	entries := make([]db.FileIndex, 0, fileIndexInsertBatchSize)
	flush := func() error {
		if err := insertFileIndexEntries(session, entries); err != nil {
			return err
		}
		entries = entries[:0]
		return nil
	}
	if produce != nil {
		if err := produce(func(entry db.FileIndex) error {
			entries = append(entries, entry)
			if len(entries) == fileIndexInsertBatchSize {
				return flush()
			}
			return nil
		}); err != nil {
			return err
		}
	}
	return flush()
}

func insertFileIndexEntries(session *xorm.Session, entries []db.FileIndex) error {
	for start := 0; start < len(entries); start += fileIndexInsertBatchSize {
		end := min(start+fileIndexInsertBatchSize, len(entries))
		values := make([]interface{}, end-start)
		for index := start; index < end; index++ {
			values[index-start] = &entries[index]
		}
		if _, err := session.Insert(values...); err != nil {
			return err
		}
	}
	return nil
}

func (repository *fileIndexRepository) Search(query string, includeContent bool, limit int) ([]db.FileIndex, error) {
	pattern := "%" + escapeLike(strings.ToLower(query)) + "%"
	session := repository.engine.Where("LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(path) LIKE ? ESCAPE '\\'", pattern, pattern)
	if includeContent {
		session = repository.engine.Where(
			"LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(path) LIKE ? ESCAPE '\\' OR LOWER(content) LIKE ? ESCAPE '\\'",
			pattern, pattern, pattern,
		)
	}
	results := make([]db.FileIndex, 0)
	err := session.Asc("is_directory", "path").Limit(limit).Find(&results)
	return results, err
}

func escapeLike(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, "%", `\%`)
	return strings.ReplaceAll(value, "_", `\_`)
}
