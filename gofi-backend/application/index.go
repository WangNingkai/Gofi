package application

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"gofi/db"
	"gofi/env"
	"gofi/localfs"
	"gofi/repository"
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
	produce, err := service.scan("/")
	if err != nil {
		return err
	}
	return service.repository.ReplaceAll(produce)
}

func (service *IndexService) Refresh(paths ...string) {
	if !service.enabled {
		return
	}
	for _, logical := range paths {
		logical = normalizeLogicalPath(logical)
		produce, err := service.scan(logical)
		if err != nil && !os.IsNotExist(err) && err != ErrNotFound {
			continue
		}
		if err != nil {
			produce = emptyFileIndexProducer
		}
		service.mutex.Lock()
		_ = service.repository.ReplacePrefix(logical, produce)
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

func (service *IndexService) scan(logical string) (repository.FileIndexProducer, error) {
	root, err := service.configuration.StorageRoot()
	if err != nil {
		return nil, err
	}
	local, err := localfs.NewLocal(root)
	if err != nil {
		return nil, err
	}
	start, err := local.ResolveExisting(logical)
	if err != nil {
		return nil, mapStorageError(err)
	}
	return func(yield func(db.FileIndex) error) error {
		return filepath.WalkDir(start, func(path string, entry fs.DirEntry, walkErr error) error {
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
			return yield(indexed)
		})
	}, nil
}

func emptyFileIndexProducer(_ func(db.FileIndex) error) error { return nil }
