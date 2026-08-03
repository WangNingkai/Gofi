package repository_test

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"gofi/db"
	"gofi/repository"

	"github.com/stretchr/testify/require"
)

func TestReplaceAllInBatches(t *testing.T) {
	databasePath := filepath.Join(t.TempDir(), "index.db")
	require.NoError(t, db.Open(databasePath, false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	db.Engine().SetMaxOpenConns(1)
	_, err := db.Engine().Exec("PRAGMA wal_autocheckpoint=0")
	require.NoError(t, err)

	entries := make([]db.FileIndex, fileIndexTestEntryCount)
	for index := range entries {
		entries[index] = db.FileIndex{
			Path: fmt.Sprintf("/entry-%04d.txt", index),
			Name: fmt.Sprintf("entry-%04d.txt", index),
		}
	}
	require.NoError(t, repository.NewFileIndexRepository(db.Engine()).ReplaceAll(produceEntries(entries)))

	count, err := db.Engine().Count(new(db.FileIndex))
	require.NoError(t, err)
	require.EqualValues(t, fileIndexTestEntryCount, count)

	wal, err := os.Stat(databasePath + "-wal")
	require.NoError(t, err)
	require.Zero(t, wal.Size())
}

func TestReplaceAllRollsBackWhenProducerFails(t *testing.T) {
	require.NoError(t, db.Open(filepath.Join(t.TempDir(), "rollback.db"), false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	index := repository.NewFileIndexRepository(db.Engine())
	require.NoError(t, index.ReplaceAll(produceEntries([]db.FileIndex{{Path: "/existing.txt", Name: "existing.txt"}})))

	expected := errors.New("scan failed")
	err := index.ReplaceAll(func(yield func(db.FileIndex) error) error {
		require.NoError(t, yield(db.FileIndex{Path: "/replacement.txt", Name: "replacement.txt"}))
		return expected
	})
	require.ErrorIs(t, err, expected)

	var entries []db.FileIndex
	require.NoError(t, db.Engine().Find(&entries))
	require.Len(t, entries, 1)
	require.Equal(t, "/existing.txt", entries[0].Path)
}

func produceEntries(entries []db.FileIndex) repository.FileIndexProducer {
	return func(yield func(db.FileIndex) error) error {
		for _, entry := range entries {
			if err := yield(entry); err != nil {
				return err
			}
		}
		return nil
	}
}

const fileIndexTestEntryCount = 1001
