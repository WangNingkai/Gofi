package application

import "errors"

var (
	ErrAlreadyInitialized = errors.New("application already initialized")
	ErrNotInitialized     = errors.New("application is not initialized")
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUnauthenticated    = errors.New("authentication required")
	ErrForbidden          = errors.New("permission denied")
	ErrNotFound           = errors.New("resource not found")
	ErrConflict           = errors.New("resource conflict")
	ErrPreviewReadOnly    = errors.New("preview mode is read only")
)
