package application_test

import (
	"crypto/md5"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

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
