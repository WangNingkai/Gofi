package application

import (
	"gofi/env"
	"gofi/repository"

	"xorm.io/xorm"
)

type Application struct {
	Configuration  *ConfigurationService
	Authentication *AuthenticationService
	Permissions    *PermissionService
	Files          *FileService
	Uploads        *ResumableUploadService
	Index          *IndexService
}

func New(engine *xorm.Engine, config *env.Configuration) *Application {
	configurationRepository := repository.NewConfigurationRepository(engine)
	userRepository := repository.NewUserRepository(engine)
	permissionRepository := repository.NewPermissionRepository(engine)
	indexRepository := repository.NewFileIndexRepository(engine)

	configurationService := NewConfigurationService(configurationRepository, userRepository)
	files := NewFileService(configurationService)
	index := NewIndexService(configurationService, indexRepository, config)
	files.SetChangeHook(index.Refresh)
	uploads := NewResumableUploadService(configurationService)
	uploads.SetChangeHook(index.Refresh)
	return &Application{
		Configuration:  configurationService,
		Authentication: NewAuthenticationService(userRepository),
		Permissions:    NewPermissionService(permissionRepository),
		Files:          files,
		Uploads:        uploads,
		Index:          index,
	}
}
