package localfs

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var (
	ErrInvalidPath = errors.New("invalid logical path")
	ErrPathEscape  = errors.New("path escapes storage root")
	ErrInvalidName = errors.New("invalid file name")
)

// Local 将 API 使用的逻辑路径限制在一个经过解析的本地根目录内。
type Local struct {
	root string
}

func NewLocal(root string) (*Local, error) {
	if strings.TrimSpace(root) == "" {
		return nil, ErrInvalidPath
	}

	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve storage root: %w", err)
	}
	resolved, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return nil, fmt.Errorf("resolve storage root symlinks: %w", err)
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return nil, fmt.Errorf("stat storage root: %w", err)
	}
	if !info.IsDir() {
		return nil, ErrInvalidPath
	}

	return &Local{root: filepath.Clean(resolved)}, nil
}

func (local *Local) Root() string {
	return local.root
}

// ResolveExisting 解析必须已经存在的逻辑路径，并阻止符号链接逃出根目录。
func (local *Local) ResolveExisting(logicalPath string) (string, error) {
	candidate, err := local.candidate(logicalPath)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(candidate)
	if err != nil {
		return "", err
	}
	if !local.contains(resolved) {
		return "", ErrPathEscape
	}
	return resolved, nil
}

// ResolveForCreate 解析可能尚不存在的路径，并校验其最近存在父目录的符号链接边界。
func (local *Local) ResolveForCreate(logicalPath string) (string, error) {
	candidate, err := local.candidate(logicalPath)
	if err != nil {
		return "", err
	}

	existing := candidate
	for {
		if _, statErr := os.Lstat(existing); statErr == nil {
			break
		} else if !os.IsNotExist(statErr) {
			return "", statErr
		}
		parent := filepath.Dir(existing)
		if parent == existing {
			return "", ErrPathEscape
		}
		existing = parent
	}

	resolvedParent, err := filepath.EvalSymlinks(existing)
	if err != nil {
		return "", err
	}
	if !local.contains(resolvedParent) {
		return "", ErrPathEscape
	}

	relativeTail, err := filepath.Rel(existing, candidate)
	if err != nil {
		return "", err
	}
	resolved := filepath.Join(resolvedParent, relativeTail)
	if !local.contains(resolved) {
		return "", ErrPathEscape
	}
	return resolved, nil
}

// ResolveForRemoval 校验父目录边界，但不跟随最后一级符号链接。
func (local *Local) ResolveForRemoval(logicalPath string) (string, error) {
	candidate, err := local.candidate(logicalPath)
	if err != nil {
		return "", err
	}
	if candidate == local.root {
		return candidate, nil
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(candidate))
	if err != nil {
		return "", err
	}
	if !local.contains(parent) {
		return "", ErrPathEscape
	}
	entry := filepath.Join(parent, filepath.Base(candidate))
	if _, err := os.Lstat(entry); err != nil {
		return "", err
	}
	return entry, nil
}

func ValidateName(name string) error {
	if name == "" || name == "." || name == ".." || strings.ContainsRune(name, '\x00') {
		return ErrInvalidName
	}
	if strings.ContainsAny(name, `/\`) || filepath.Base(name) != name {
		return ErrInvalidName
	}
	return nil
}

func (local *Local) candidate(logicalPath string) (string, error) {
	if logicalPath == "" {
		logicalPath = "/"
	}
	if strings.ContainsRune(logicalPath, '\x00') {
		return "", ErrInvalidPath
	}

	normalized := strings.ReplaceAll(logicalPath, `\`, "/")
	if !strings.HasPrefix(normalized, "/") {
		return "", ErrInvalidPath
	}
	for _, segment := range strings.Split(normalized, "/") {
		if segment == ".." {
			return "", ErrPathEscape
		}
	}

	relative := strings.TrimPrefix(normalized, "/")
	candidate := filepath.Join(local.root, filepath.FromSlash(relative))
	if !local.contains(candidate) {
		return "", ErrPathEscape
	}
	return candidate, nil
}

func (local *Local) contains(candidate string) bool {
	relative, err := filepath.Rel(local.root, filepath.Clean(candidate))
	if err != nil {
		return false
	}
	return relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)))
}
