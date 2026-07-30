package repository

import (
	"gofi/db"

	"github.com/go-xorm/xorm"
)

type PermissionRepository interface {
	ListGuest() ([]db.Permission, error)
	GuestAllowed(name db.Name) (bool, error)
	UpdateGuest(permissions []db.Permission) error
}

type permissionRepository struct {
	engine *xorm.Engine
}

func NewPermissionRepository(engine *xorm.Engine) PermissionRepository {
	return &permissionRepository{engine: engine}
}

func (repository *permissionRepository) ListGuest() ([]db.Permission, error) {
	permissions := make([]db.Permission, 0)
	err := repository.engine.Where("role_type = ?", db.RoleTypeGuest).Find(&permissions)
	return permissions, err
}

func (repository *permissionRepository) GuestAllowed(name db.Name) (bool, error) {
	permission := new(db.Permission)
	has, err := repository.engine.Where("role_type = ? AND name = ?", db.RoleTypeGuest, name).Get(permission)
	if err != nil || !has {
		return false, err
	}
	return permission.Enable, nil
}

func (repository *permissionRepository) UpdateGuest(permissions []db.Permission) error {
	session := repository.engine.NewSession()
	defer session.Close()
	if err := session.Begin(); err != nil {
		return err
	}
	for _, permission := range permissions {
		permission.RoleType = db.RoleTypeGuest
		if _, err := session.Where("role_type = ? AND name = ?", db.RoleTypeGuest, permission.Name).
			Cols("enable").Update(&permission); err != nil {
			_ = session.Rollback()
			return err
		}
	}
	return session.Commit()
}
