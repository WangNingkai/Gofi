package db

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
	"xorm.io/xorm"
)

func TestMigrateLegacyDatabase(t *testing.T) {
	engine, err := xorm.NewEngine(sqliteDriverName, filepath.Join(t.TempDir(), "legacy.db"))
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

	legacyTime := time.Date(2026, 7, 31, 0, 30, 0, 0, time.UTC)
	legacyTimestamp := legacyTime.Format(time.DateTime)
	_, err = engine.Exec(
		"UPDATE user SET created = ?, updated = ? WHERE username = ?",
		legacyTimestamp,
		legacyTimestamp,
		"legacy",
	)
	require.NoError(t, err)

	user = new(User)
	found, err = engine.Where("username = ?", "legacy").Get(user)
	require.NoError(t, err)
	require.True(t, found)
	require.True(t, legacyTime.Equal(user.Created), "%s != %s", legacyTime, user.Created)
	require.True(t, legacyTime.Equal(user.Updated), "%s != %s", legacyTime, user.Updated)
}

func TestOpenConfiguresSQLiteForConcurrentReads(t *testing.T) {
	require.NoError(t, Open(filepath.Join(t.TempDir(), "concurrent.db"), false))
	t.Cleanup(func() { require.NoError(t, Close()) })

	journalMode, err := Engine().QueryString("PRAGMA journal_mode")
	require.NoError(t, err)
	require.Equal(t, "wal", journalMode[0]["journal_mode"])

	busyTimeout, err := Engine().QueryString("PRAGMA busy_timeout")
	require.NoError(t, err)
	require.Equal(t, "5000", busyTimeout[0]["timeout"])
}
