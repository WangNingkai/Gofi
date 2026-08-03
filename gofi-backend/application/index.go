package application

import (
	"io/fs"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"sync"

	"gofi/db"
	"gofi/env"
	"gofi/repository"
	"gofi/storage"
	"gofi/tool"
)

const maxIndexedContentSize int64 = 64 << 10

type IndexService struct {
	configuration *ConfigurationService
	repository    repository.FileIndexRepository
	enabled       bool
	mutex         sync.Mutex
}

func NewIndexService(
	configuration *ConfigurationService,
	repository repository.FileIndexRepository,
	config *env.Configuration,
) *IndexService {
	return &IndexService{configuration: configuration, repository: repository, enabled: config.EnableIndex}
}

func (service *IndexService) Rebuild() error {
	if !service.enabled {
		return nil
	}
	service.mutex.Lock()
	defer service.mutex.Unlock()
	entries, err := service.scan("/")
	if err != nil {
		debug.FreeOSMemory()
		return err
	}
	err = service.repository.ReplaceAll(entries)
	// Large roots can temporarily retain hundreds of megabytes of file metadata
	// and indexed text. Release the completed scan promptly instead of keeping
	// that transient heap until a later GC cycle.
	entries = nil
	debug.FreeOSMemory()
	return err
}

func (service *IndexService) Refresh(paths ...string) {
	if !service.enabled {
		return
	}
	for _, logical := range paths {
		logical = normalizeLogicalPath(logical)
		entries, err := service.scan(logical)
		if err != nil && !os.IsNotExist(err) && err != ErrNotFound {
			continue
		}
		service.mutex.Lock()
		_ = service.repository.ReplacePrefix(logical, entries)
		service.mutex.Unlock()
	}
}

func (service *IndexService) Search(query string, includeContent bool, limit int) ([]db.FileIndex, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, ErrInvalidInput
	}
	if !service.enabled {
		return []db.FileIndex{}, nil
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	return service.repository.Search(query, includeContent, limit)
}

func (service *IndexService) scan(logical string) ([]db.FileIndex, error) {
	root, err := service.configuration.StorageRoot()
	if err != nil {
		return nil, err
	}
	local, err := storage.NewLocal(root)
	if err != nil {
		return nil, err
	}
	start, err := local.ResolveExisting(logical)
	if err != nil {
		return []db.FileIndex{}, mapStorageError(err)
	}
	entries := make([]db.FileIndex, 0)
	err = filepath.WalkDir(start, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if path == local.Root() {
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if tool.IsHiddenFile(entry.Name()) {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return nil
		}
		relative, err := filepath.Rel(local.Root(), path)
		if err != nil {
			return nil
		}
		indexed := db.FileIndex{
			Path:        "/" + filepath.ToSlash(relative),
			Name:        entry.Name(),
			IsDirectory: info.IsDir(),
			Size:        info.Size(),
			Modified:    info.ModTime().Unix(),
		}
		if !info.IsDir() && info.Size() <= maxIndexedContentSize && tool.IsTextFile(path) {
			if content, readErr := os.ReadFile(path); readErr == nil {
				indexed.Content = string(content)
			}
		}
		entries = append(entries, indexed)
		return nil
	})
	return entries, err
}
