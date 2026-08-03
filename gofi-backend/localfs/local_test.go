package localfs

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLocalResolveBoundaries(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(root, "inside"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(root, "inside", "file.txt"), []byte("ok"), 0o600))

	local, err := NewLocal(root)
	require.NoError(t, err)

	resolved, err := local.ResolveExisting("/inside/file.txt")
	require.NoError(t, err)
	require.Equal(t, filepath.Join(local.Root(), "inside", "file.txt"), resolved)

	_, err = local.ResolveExisting("/../outside")
	require.ErrorIs(t, err, ErrPathEscape)

	similarPrefix := root + "-other"
	require.NoError(t, os.Mkdir(similarPrefix, 0o755))
	t.Cleanup(func() { _ = os.RemoveAll(similarPrefix) })
	require.NoError(t, os.WriteFile(filepath.Join(similarPrefix, "file.txt"), []byte("outside"), 0o600))
	_, err = local.ResolveExisting("/../" + filepath.Base(similarPrefix) + "/file.txt")
	require.ErrorIs(t, err, ErrPathEscape)
}

func TestLocalRejectsEscapingSymlink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows 创建符号链接通常需要额外权限")
	}

	root := t.TempDir()
	outside := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("secret"), 0o600))
	require.NoError(t, os.Symlink(outside, filepath.Join(root, "escape")))

	local, err := NewLocal(root)
	require.NoError(t, err)
	_, err = local.ResolveExisting("/escape/secret.txt")
	require.True(t, errors.Is(err, ErrPathEscape), err)
	_, err = local.ResolveForCreate("/escape/new.txt")
	require.True(t, errors.Is(err, ErrPathEscape), err)
}

func TestResolveForRemovalDoesNotFollowFinalSymlink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows 创建符号链接通常需要额外权限")
	}

	root := t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(root, "target"), 0o755))
	link := filepath.Join(root, "link")
	require.NoError(t, os.Symlink(filepath.Join(root, "target"), link))

	local, err := NewLocal(root)
	require.NoError(t, err)
	resolved, err := local.ResolveForRemoval("/link")
	require.NoError(t, err)
	require.Equal(t, filepath.Join(local.Root(), "link"), resolved)
}

func TestValidateName(t *testing.T) {
	require.NoError(t, ValidateName("report.txt"))
	for _, name := range []string{"", ".", "..", "../report", "a/b", `a\b`, "bad\x00name"} {
		require.ErrorIs(t, ValidateName(name), ErrInvalidName, name)
	}
}
