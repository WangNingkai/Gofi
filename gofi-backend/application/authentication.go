package application

import (
	"fmt"
	"strings"

	"gofi/db"
	"gofi/env"
	"gofi/repository"
	"gofi/tool"
)

type CurrentUser struct {
	ID       int64       `json:"id"`
	RoleType db.RoleType `json:"roleType"`
	Username string      `json:"username"`
}

type AuthenticationService struct {
	users repository.UserRepository
}

func NewAuthenticationService(users repository.UserRepository) *AuthenticationService {
	return &AuthenticationService{users: users}
}

func (service *AuthenticationService) Login(username, password string) (string, error) {
	user, err := service.users.GetByUsername(strings.TrimSpace(username))
	if err != nil {
		return "", ErrInvalidCredentials
	}
	valid, needsUpgrade := tool.VerifyPassword(user.Password, password)
	if !valid {
		return "", ErrInvalidCredentials
	}
	if needsUpgrade {
		hash, hashErr := tool.HashPassword(password)
		if hashErr != nil {
			return "", hashErr
		}
		if err := service.users.UpdatePassword(user.Id, hash); err != nil {
			return "", fmt.Errorf("upgrade password hash: %w", err)
		}
	}
	return tool.GenerateJWT(user.Id, user.Username, int(user.RoleType), user.TokenVersion)
}

func (service *AuthenticationService) Authenticate(token string) (*db.User, error) {
	token = strings.TrimSpace(token)
	if strings.HasPrefix(strings.ToLower(token), "bearer ") {
		token = strings.TrimSpace(token[7:])
	}
	if token == "" {
		return nil, ErrUnauthenticated
	}
	claims, err := tool.ParseJWTString(token)
	if err != nil {
		return nil, ErrUnauthenticated
	}
	user, err := service.users.GetByID(claims.UserId)
	if err != nil {
		return nil, ErrUnauthenticated
	}
	if user.Username != claims.Username || int(user.RoleType) != claims.RoleType ||
		user.TokenVersion != claims.TokenVersion {
		return nil, ErrUnauthenticated
	}
	return user, nil
}

func (service *AuthenticationService) Current(user *db.User) CurrentUser {
	return CurrentUser{ID: user.Id, RoleType: user.RoleType, Username: user.Username}
}

func (service *AuthenticationService) ChangePassword(
	user *db.User,
	currentPassword string,
	newPassword string,
	confirmation string,
) error {
	if env.IsPreview() {
		return ErrPreviewReadOnly
	}
	if newPassword != confirmation {
		return fmt.Errorf("%w: password confirmation does not match", ErrInvalidInput)
	}
	valid, _ := tool.VerifyPassword(user.Password, currentPassword)
	if !valid {
		return ErrInvalidCredentials
	}
	hash, err := tool.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	return service.users.UpdatePasswordAndRevokeSessions(user.Id, hash)
}

func (service *AuthenticationService) Logout(user *db.User) error {
	return service.users.IncrementTokenVersion(user.Id)
}
