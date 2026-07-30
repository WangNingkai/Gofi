package application

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"gofi/db"
	"gofi/env"
	"gofi/repository"
	"gofi/tool"
)

type PublicConfiguration struct {
	Initialized bool   `json:"initialized"`
	Version     string `json:"version"`
}

type AdminConfiguration struct {
	PublicConfiguration
	CustomStoragePath  string `json:"customStoragePath"`
	DefaultStoragePath string `json:"defaultStoragePath"`
}

type SetupInput struct {
	CustomStoragePath string `json:"customStoragePath"`
	AdminUsername     string `json:"adminUsername"`
	AdminPassword     string `json:"adminPassword"`
}

type ConfigurationService struct {
	configurations repository.ConfigurationRepository
	users          repository.UserRepository
	setupMutex     sync.Mutex
}

func NewConfigurationService(
	configurations repository.ConfigurationRepository,
	users repository.UserRepository,
) *ConfigurationService {
	return &ConfigurationService{configurations: configurations, users: users}
}

func (service *ConfigurationService) Public() (*PublicConfiguration, error) {
	configuration, err := service.configurations.Get()
	if err != nil {
		return nil, err
	}
	return &PublicConfiguration{Initialized: configuration.Initialized, Version: db.Version()}, nil
}

func (service *ConfigurationService) Admin() (*AdminConfiguration, error) {
	configuration, err := service.configurations.Get()
	if err != nil {
		return nil, err
	}
	return service.adminDTO(configuration), nil
}

func (service *ConfigurationService) Setup(input SetupInput) (*AdminConfiguration, error) {
	service.setupMutex.Lock()
	defer service.setupMutex.Unlock()

	configuration, err := service.configurations.Get()
	if err != nil {
		return nil, err
	}
	if configuration.Initialized {
		return nil, ErrAlreadyInitialized
	}

	username := strings.TrimSpace(input.AdminUsername)
	if username == "" {
		username = db.AdminUsername
	}
	if len(username) < 3 || len(username) > 64 || strings.ContainsAny(username, "\r\n\t ") {
		return nil, fmt.Errorf("%w: invalid administrator username", ErrInvalidInput)
	}
	passwordHash, err := tool.HashPassword(input.AdminPassword)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}

	storagePath, customPath, err := normalizeStoragePath(input.CustomStoragePath)
	if err != nil {
		return nil, err
	}
	if err := ensureWritableDirectory(storagePath); err != nil {
		return nil, fmt.Errorf("%w: storage directory is not writable", ErrInvalidInput)
	}

	hasAdmin, err := service.users.ExistsByRole(db.RoleTypeAdmin)
	if err != nil {
		return nil, err
	}
	if hasAdmin {
		return nil, ErrConflict
	}
	admin := &db.User{
		RoleType: db.RoleTypeAdmin,
		Username: username,
		Password: passwordHash,
	}
	if err := service.users.Create(admin); err != nil {
		return nil, err
	}

	configuration.CustomStoragePath = customPath
	configuration.Initialized = true
	if err := service.configurations.Update(configuration); err != nil {
		if cleanupErr := service.users.Delete(admin.Id); cleanupErr != nil {
			return nil, fmt.Errorf("update configuration: %v; rollback administrator: %w", err, cleanupErr)
		}
		return nil, err
	}
	return service.adminDTO(configuration), nil
}

func (service *ConfigurationService) UpdateStorage(path string) (*AdminConfiguration, error) {
	if env.IsPreview() {
		return nil, ErrPreviewReadOnly
	}
	configuration, err := service.configurations.Get()
	if err != nil {
		return nil, err
	}
	if !configuration.Initialized {
		return nil, ErrNotInitialized
	}

	storagePath, customPath, err := normalizeStoragePath(path)
	if err != nil {
		return nil, err
	}
	if err := ensureWritableDirectory(storagePath); err != nil {
		return nil, fmt.Errorf("%w: storage directory is not writable", ErrInvalidInput)
	}
	configuration.CustomStoragePath = customPath
	if err := service.configurations.Update(configuration); err != nil {
		return nil, err
	}
	return service.adminDTO(configuration), nil
}

func (service *ConfigurationService) StorageRoot() (string, error) {
	configuration, err := service.configurations.Get()
	if err != nil {
		return "", err
	}
	if !configuration.Initialized {
		return "", ErrNotInitialized
	}
	if configuration.CustomStoragePath != "" {
		return configuration.CustomStoragePath, nil
	}
	return tool.GetDefaultStorageDir(), nil
}

func (service *ConfigurationService) adminDTO(configuration *db.Configuration) *AdminConfiguration {
	return &AdminConfiguration{
		PublicConfiguration: PublicConfiguration{
			Initialized: configuration.Initialized,
			Version:     db.Version(),
		},
		CustomStoragePath:  configuration.CustomStoragePath,
		DefaultStoragePath: tool.GetDefaultStorageDir(),
	}
}

func normalizeStoragePath(value string) (storagePath string, customPath string, err error) {
	value = strings.TrimSpace(value)
	if value == "" {
		defaultPath := tool.GetDefaultStorageDir()
		if err := os.MkdirAll(defaultPath, 0o750); err != nil {
			return "", "", err
		}
		return defaultPath, "", nil
	}
	absolute, err := filepath.Abs(value)
	if err != nil {
		return "", "", fmt.Errorf("%w: invalid storage path", ErrInvalidInput)
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return "", "", fmt.Errorf("%w: storage path does not exist", ErrInvalidInput)
	}
	if !info.IsDir() {
		return "", "", fmt.Errorf("%w: storage path is not a directory", ErrInvalidInput)
	}
	return filepath.Clean(absolute), filepath.Clean(absolute), nil
}

func ensureWritableDirectory(path string) error {
	probe, err := os.CreateTemp(path, ".gofi-write-check-*")
	if err != nil {
		return err
	}
	name := probe.Name()
	closeErr := probe.Close()
	removeErr := os.Remove(name)
	return errors.Join(closeErr, removeErr)
}
