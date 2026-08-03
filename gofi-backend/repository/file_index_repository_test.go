package repository_test

import (
	"fmt"
	"path/filepath"
	"testing"

	"gofi/db"
	"gofi/repository"

	"github.com/stretchr/testify/require"
)

func TestReplaceAllInBatches(t *testing.T) {
	require.NoError(t, db.Open(filepath.Join(t.TempDir(), "index.db"), false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	entries := make([]db.FileIndex, fileIndexTestEntryCount)
	for index := range entries {
		entries[index] = db.FileIndex{
			Path: fmt.Sprintf("/entry-%04d.txt", index),
			Name: fmt.Sprintf("entry-%04d.txt", index),
		}
	}
	require.NoError(t, repository.NewFileIndexRepository(db.Engine()).ReplaceAll(entries))

	count, err := db.Engine().Count(new(db.FileIndex))
	require.NoError(t, err)
	require.EqualValues(t, fileIndexTestEntryCount, count)
}

const fileIndexTestEntryCount = 1001
