package application

import (
	"fmt"

	"gofi/db"
	"gofi/repository"
)

type PermissionService struct {
	permissions repository.PermissionRepository
}

func NewPermissionService(permissions repository.PermissionRepository) *PermissionService {
	return &PermissionService{permissions: permissions}
}

func (service *PermissionService) ListGuest() ([]db.Permission, error) {
	return service.permissions.ListGuest()
}

func (service *PermissionService) GuestAllowed(name db.Name) (bool, error) {
	return service.permissions.GuestAllowed(name)
}

func (service *PermissionService) Authorize(user *db.User, name db.Name) error {
	if user != nil {
		return nil
	}
	allowed, err := service.GuestAllowed(name)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrUnauthenticated
	}
	return nil
}

func (service *PermissionService) UpdateGuest(permissions []db.Permission) error {
	known := map[db.Name]bool{
		db.FileListPageAccess: true,
		db.FileUpload:         true,
		db.FileDownload:       true,
		db.FilePreview:        true,
		db.FileRemove:         true,
	}
	for _, permission := range permissions {
		if !known[permission.Name] {
			return fmt.Errorf("%w: unknown permission", ErrInvalidInput)
		}
	}
	return service.permissions.UpdateGuest(permissions)
}
