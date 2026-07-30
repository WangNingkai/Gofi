package application

import (
	"gofi/env"
	"gofi/repository"

	"github.com/go-xorm/xorm"
)

type Application struct {
	Configuration  *ConfigurationService
	Authentication *AuthenticationService
	Permissions    *PermissionService
	Files          *FileService
}

func New(engine *xorm.Engine, config *env.Configuration) *Application {
	configurationRepository := repository.NewConfigurationRepository(engine)
	userRepository := repository.NewUserRepository(engine)
	permissionRepository := repository.NewPermissionRepository(engine)

	configurationService := NewConfigurationService(configurationRepository, userRepository)
	return &Application{
		Configuration:  configurationService,
		Authentication: NewAuthenticationService(userRepository),
		Permissions:    NewPermissionService(permissionRepository),
		Files:          NewFileService(configurationService),
	}
}
