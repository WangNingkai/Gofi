package repository

import (
	"gofi/db"

	"github.com/go-xorm/xorm"
)

// UserRepository 用户数据访问接口
type UserRepository interface {
	// Create 创建用户
	Create(user *db.User) error
	Delete(userID int64) error

	// GetByID 根据ID获取用户
	GetByID(id int64) (*db.User, error)

	// GetByUsername 根据用户名获取用户
	GetByUsername(username string) (*db.User, error)

	// UpdatePassword 更新用户密码
	UpdatePassword(userID int64, password string) error
	UpdatePasswordAndRevokeSessions(userID int64, password string) error
	IncrementTokenVersion(userID int64) error

	// ExistsByRole 检查指定角色的用户是否存在
	ExistsByRole(roleType db.RoleType) (bool, error)
}

// userRepository 用户数据访问实现
type userRepository struct {
	engine *xorm.Engine
}

// NewUserRepository 创建用户Repository实例
func NewUserRepository(engine *xorm.Engine) UserRepository {
	return &userRepository{engine: engine}
}

func (r *userRepository) Create(user *db.User) error {
	_, err := r.engine.InsertOne(user)
	return err
}

func (r *userRepository) Delete(userID int64) error {
	_, err := r.engine.ID(userID).Delete(new(db.User))
	return err
}

func (r *userRepository) GetByID(id int64) (*db.User, error) {
	user := new(db.User)
	has, err := r.engine.ID(id).Get(user)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, db.ErrUserNotExist
	}
	return user, nil
}

func (r *userRepository) GetByUsername(username string) (*db.User, error) {
	user := new(db.User)
	has, err := r.engine.Where("username=?", username).Get(user)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, db.ErrUserNotExist
	}
	return user, nil
}

func (r *userRepository) UpdatePassword(userID int64, password string) error {
	user := new(db.User)
	user.Password = password
	_, err := r.engine.ID(userID).Cols("password").Update(user)
	return err
}

func (r *userRepository) UpdatePasswordAndRevokeSessions(userID int64, password string) error {
	user := new(db.User)
	user.Password = password
	_, err := r.engine.ID(userID).Cols("password").Incr("token_version", 1).Update(user)
	return err
}

func (r *userRepository) IncrementTokenVersion(userID int64) error {
	_, err := r.engine.ID(userID).Incr("token_version", 1).Update(new(db.User))
	return err
}

func (r *userRepository) ExistsByRole(roleType db.RoleType) (bool, error) {
	user := new(db.User)
	has, err := r.engine.Where("role_type=?", roleType).Get(user)
	if err != nil {
		return false, err
	}
	return has, nil
}
