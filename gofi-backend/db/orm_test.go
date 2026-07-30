package db

import (
	"path/filepath"
	"testing"

	"github.com/go-xorm/xorm"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestMigrateLegacyDatabase(t *testing.T) {
	engine, err := xorm.NewEngine("sqlite3", filepath.Join(t.TempDir(), "legacy.db"))
	require.NoError(t, err)
	defer engine.Close()

	_, err = engine.Exec(`
		CREATE TABLE user (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			role_type INTEGER,
			username TEXT UNIQUE,
			password TEXT
		);
		INSERT INTO user(role_type, username, password)
		VALUES (1, 'legacy', '5f4dcc3b5aa765d61d8327deb882cf99');
	`)
	require.NoError(t, err)
	require.NoError(t, Migrate(engine))

	columns, err := engine.DBMetas()
	require.NoError(t, err)
	var hasTokenVersion bool
	for _, table := range columns {
		if table.Name != "user" {
			continue
		}
		for _, column := range table.Columns() {
			if column.Name == "token_version" {
				hasTokenVersion = true
			}
		}
	}
	require.True(t, hasTokenVersion)

	migration := new(SchemaMigration)
	found, err := engine.ID(1).Get(migration)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, CurrentSchemaVersion, migration.Version)

	user := new(User)
	found, err = engine.Where("username = ?", "legacy").Get(user)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "5f4dcc3b5aa765d61d8327deb882cf99", user.Password)
}
