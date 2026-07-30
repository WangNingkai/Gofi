package application

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"path"
	"strings"
	"time"

	"gofi/db"
	"gofi/repository"
)

type CreatedShare struct {
	ID        int64     `json:"id"`
	Token     string    `json:"token"`
	Path      string    `json:"path"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type ShareService struct {
	repository repository.ShareRepository
	files      *FileService
}

func NewShareService(repository repository.ShareRepository, files *FileService) *ShareService {
	return &ShareService{repository: repository, files: files}
}

func (service *ShareService) Create(logicalPath string, expiresInHours int) (*CreatedShare, error) {
	logicalPath = normalizeLogicalPath(logicalPath)
	if _, err := service.files.Get(logicalPath); err != nil {
		return nil, err
	}
	if expiresInHours < 1 || expiresInHours > 24*365 {
		return nil, ErrInvalidInput
	}
	token, err := secureID()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().UTC().Add(time.Duration(expiresInHours) * time.Hour)
	share := &db.Share{TokenHash: hashToken(token), Path: logicalPath, ExpiresAt: expiresAt}
	if err := service.repository.Create(share); err != nil {
		return nil, err
	}
	return &CreatedShare{ID: share.ID, Token: token, Path: share.Path, ExpiresAt: expiresAt}, nil
}

func (service *ShareService) List() ([]db.Share, error) {
	return service.repository.List()
}

func (service *ShareService) Revoke(id int64) error {
	if err := service.repository.Revoke(id); err != nil {
		if err == db.ErrRecordNotFound {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (service *ShareService) Resolve(token, requested string) (string, error) {
	if !validID(token) {
		return "", ErrNotFound
	}
	share, err := service.repository.GetActive(hashToken(token), time.Now().UTC())
	if err != nil {
		return "", err
	}
	if share == nil {
		return "", ErrNotFound
	}
	requested = strings.TrimSpace(requested)
	if requested == "" || requested == "/" {
		return share.Path, nil
	}
	requested = normalizeLogicalPath(requested)
	base := strings.TrimSuffix(share.Path, "/")
	resolved := normalizeLogicalPath(path.Join(base, requested))
	if resolved != base && !strings.HasPrefix(resolved, base+"/") {
		return "", fmt.Errorf("%w: shared path escape", ErrForbidden)
	}
	return resolved, nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
