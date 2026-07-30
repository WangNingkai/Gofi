package repository

import (
	"strings"

	"gofi/db"

	"github.com/go-xorm/xorm"
)

type FileIndexRepository interface {
	ReplaceAll(entries []db.FileIndex) error
	ReplacePrefix(prefix string, entries []db.FileIndex) error
	Search(query string, includeContent bool, limit int) ([]db.FileIndex, error)
}

type fileIndexRepository struct {
	engine *xorm.Engine
}

func NewFileIndexRepository(engine *xorm.Engine) FileIndexRepository {
	return &fileIndexRepository{engine: engine}
}

func (repository *fileIndexRepository) ReplaceAll(entries []db.FileIndex) error {
	session := repository.engine.NewSession()
	defer session.Close()
	if err := session.Begin(); err != nil {
		return err
	}
	if _, err := session.Where("1 = 1").Delete(new(db.FileIndex)); err != nil {
		_ = session.Rollback()
		return err
	}
	if len(entries) > 0 {
		values := make([]interface{}, len(entries))
		for index := range entries {
			values[index] = &entries[index]
		}
		if _, err := session.Insert(values...); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	return session.Commit()
}

func (repository *fileIndexRepository) ReplacePrefix(prefix string, entries []db.FileIndex) error {
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
	if len(entries) > 0 {
		values := make([]interface{}, len(entries))
		for index := range entries {
			values[index] = &entries[index]
		}
		if _, err := session.Insert(values...); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	return session.Commit()
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
