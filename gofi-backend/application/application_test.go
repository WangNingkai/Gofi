package application_test

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gofi/application"
	"gofi/db"
	"gofi/env"
	"gofi/repository"

	"github.com/stretchr/testify/require"
)

func TestCoreUseCasesWithoutHTTP(t *testing.T) {
	require.NoError(t, db.Open(filepath.Join(t.TempDir(), "gofi.db"), false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	core := application.New(db.Engine(), env.GetConfiguration())
	storageDir := t.TempDir()
	configuration, err := core.Configuration.Setup(application.SetupInput{
		CustomStoragePath: storageDir,
		AdminUsername:     "owner",
		AdminPassword:     "local-test-password",
	})
	require.NoError(t, err)
	require.True(t, configuration.Initialized)

	token, err := core.Authentication.Login("owner", "local-test-password")
	require.NoError(t, err)
	user, err := core.Authentication.Authenticate(token)
	require.NoError(t, err)
	require.Equal(t, "owner", user.Username)

	require.NoError(t, os.WriteFile(filepath.Join(storageDir, "hello.txt"), []byte("hello"), 0o600))
	resource, err := core.Files.Get("/hello.txt")
	require.NoError(t, err)
	require.Equal(t, "file", resource.Type)
}

func TestLegacyMD5IsUpgradedAfterLogin(t *testing.T) {
	require.NoError(t, db.Open(filepath.Join(t.TempDir(), "legacy.db"), false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	sum := md5.Sum([]byte("legacy-password"))
	legacy := &db.User{
		RoleType: db.RoleTypeAdmin,
		Username: "legacy",
		Password: hex.EncodeToString(sum[:]),
	}
	users := repository.NewUserRepository(db.Engine())
	require.NoError(t, users.Create(legacy))

	core := application.New(db.Engine(), env.GetConfiguration())
	_, err := core.Authentication.Login("legacy", "legacy-password")
	require.NoError(t, err)

	upgraded, err := users.GetByUsername("legacy")
	require.NoError(t, err)
	require.Contains(t, upgraded.Password, "$2")
	require.NotEqual(t, legacy.Password, upgraded.Password)
}

func TestUpdateStorageReportsOnlyRealChanges(t *testing.T) {
	require.NoError(t, db.Open(filepath.Join(t.TempDir(), "configuration.db"), false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	core := application.New(db.Engine(), env.GetConfiguration())
	initialStorage := t.TempDir()
	_, err := core.Configuration.Setup(application.SetupInput{
		CustomStoragePath: initialStorage,
		AdminUsername:     "owner",
		AdminPassword:     "local-test-password",
	})
	require.NoError(t, err)

	_, changed, err := core.Configuration.UpdateStorage(initialStorage)
	require.NoError(t, err)
	require.False(t, changed)

	replacement := t.TempDir()
	configuration, changed, err := core.Configuration.UpdateStorage(replacement)
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, replacement, configuration.CustomStoragePath)
}

func TestFileManagementAndResumableUpload(t *testing.T) {
	require.NoError(t, db.Open(filepath.Join(t.TempDir(), "files.db"), false))
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	storageDir := t.TempDir()
	core := application.New(db.Engine(), env.GetConfiguration())
	_, err := core.Configuration.Setup(application.SetupInput{
		CustomStoragePath: storageDir,
		AdminUsername:     "owner",
		AdminPassword:     "local-test-password",
	})
	require.NoError(t, err)

	require.NoError(t, core.Files.CreateDirectory("/", "documents"))
	require.NoError(t, os.WriteFile(filepath.Join(storageDir, "documents", "a.txt"), []byte("alpha"), 0o600))
	require.NoError(t, core.Files.Copy("/documents/a.txt", "/documents/b.txt", false))
	require.NoError(t, core.Files.Rename("/documents/b.txt", "renamed.txt", false))
	require.NoError(t, core.Files.Move("/documents/renamed.txt", "/moved.txt", false))
	require.FileExists(t, filepath.Join(storageDir, "moved.txt"))
	results := core.Files.Batch([]application.BatchFileOperation{
		{Operation: application.FileOperationCopy, Source: "/moved.txt", Destination: "/copy.txt"},
		{Operation: application.FileOperationDelete, Source: "/missing.txt"},
	})
	require.True(t, results[0].Success)
	require.False(t, results[1].Success)
	require.Equal(t, "not_found", results[1].Error)

	content := strings.Repeat("resume-", 100000)
	totalHash := sha256.Sum256([]byte(content))
	session, err := core.Uploads.Create(application.CreateUploadSessionInput{
		Directory: "/",
		Name:      "resumed.txt",
		Size:      int64(len(content)),
		ChunkSize: 256 << 10,
		SHA256:    hex.EncodeToString(totalHash[:]),
	})
	require.NoError(t, err)
	for index := 0; index < session.ChunkCount; index++ {
		start := index * int(session.ChunkSize)
		end := min(start+int(session.ChunkSize), len(content))
		chunk := content[start:end]
		chunkHash := sha256.Sum256([]byte(chunk))
		if index == 0 {
			err := core.Uploads.WriteChunk(
				session.ID,
				index,
				strings.Repeat("0", sha256.Size*2),
				strings.NewReader(chunk),
			)
			require.ErrorIs(t, err, application.ErrInvalidInput)
			status, statusErr := core.Uploads.Status(session.ID)
			require.NoError(t, statusErr)
			require.Empty(t, status.Received)
		}
		require.NoError(t, core.Uploads.WriteChunk(
			session.ID,
			index,
			hex.EncodeToString(chunkHash[:]),
			strings.NewReader(chunk),
		))
	}

	// 新的服务实例模拟进程重启后读取磁盘会话。
	restarted := application.New(db.Engine(), env.GetConfiguration())
	status, err := restarted.Uploads.Status(session.ID)
	require.NoError(t, err)
	require.Len(t, status.Received, session.ChunkCount)
	require.NoError(t, restarted.Uploads.Complete(session.ID))
	actual, err := os.ReadFile(filepath.Join(storageDir, "resumed.txt"))
	require.NoError(t, err)
	require.Equal(t, content, string(actual))
	_, err = restarted.Uploads.Status(session.ID)
	require.ErrorIs(t, err, application.ErrNotFound)

	require.NoError(t, restarted.Index.Rebuild())
	resultsByName, err := restarted.Index.Search("resumed", false, 10)
	require.NoError(t, err)
	require.Len(t, resultsByName, 1)
	resultsByContent, err := restarted.Index.Search("resume-resume", true, 10)
	require.NoError(t, err)
	require.Len(t, resultsByContent, 0, "超过索引内容上限的文件不应读取正文")
	for index := 0; index < 30; index++ {
		name := fmt.Sprintf("capacity-%02d.txt", index)
		require.NoError(t, os.WriteFile(filepath.Join(storageDir, name), []byte("indexed"), 0o600))
	}
	require.NoError(t, restarted.Index.Rebuild())
	capped, err := restarted.Index.Search("capacity-", false, 10)
	require.NoError(t, err)
	require.Len(t, capped, 10)

	share, err := restarted.Shares.Create("/documents", 24)
	require.NoError(t, err)
	resolved, err := restarted.Shares.Resolve(share.Token, "/a.txt")
	require.NoError(t, err)
	require.Equal(t, "/documents/a.txt", resolved)
	require.NoError(t, restarted.Shares.Revoke(share.ID))
	_, err = restarted.Shares.Resolve(share.Token, "/a.txt")
	require.ErrorIs(t, err, application.ErrNotFound)

	expired, err := restarted.Shares.Create("/moved.txt", 1)
	require.NoError(t, err)
	_, err = db.Engine().ID(expired.ID).Cols("expires_at").Update(&db.Share{ExpiresAt: time.Now().Add(-time.Hour)})
	require.NoError(t, err)
	_, err = restarted.Shares.Resolve(expired.Token, "/")
	require.ErrorIs(t, err, application.ErrNotFound)
}
