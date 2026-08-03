package application

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"gofi/localfs"
)

const (
	minChunkSize     int64 = 256 << 10
	maxChunkSize     int64 = 32 << 20
	maxUploadSize    int64 = 1 << 40
	uploadSessionTTL       = 24 * time.Hour
)

type UploadSession struct {
	ID          string    `json:"id"`
	Directory   string    `json:"directory"`
	Name        string    `json:"name"`
	Size        int64     `json:"size"`
	ChunkSize   int64     `json:"chunkSize"`
	ChunkCount  int       `json:"chunkCount"`
	SHA256      string    `json:"sha256"`
	Overwrite   bool      `json:"overwrite"`
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   time.Time `json:"expiresAt"`
	Received    []int     `json:"received"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
}

type CreateUploadSessionInput struct {
	Directory string `json:"directory"`
	Name      string `json:"name"`
	Size      int64  `json:"size"`
	ChunkSize int64  `json:"chunkSize"`
	SHA256    string `json:"sha256"`
	Overwrite bool   `json:"overwrite"`
}

type ResumableUploadService struct {
	configuration *ConfigurationService
	locks         sync.Map
	onChange      func(...string)
}

func NewResumableUploadService(configuration *ConfigurationService) *ResumableUploadService {
	return &ResumableUploadService{configuration: configuration}
}

func (service *ResumableUploadService) SetChangeHook(hook func(...string)) {
	service.onChange = hook
}

func (service *ResumableUploadService) Create(input CreateUploadSessionInput) (*UploadSession, error) {
	if localfs.ValidateName(input.Name) != nil || input.Size < 0 || input.Size > maxUploadSize ||
		input.ChunkSize < minChunkSize || input.ChunkSize > maxChunkSize || !validSHA256(input.SHA256) {
		return nil, ErrInvalidInput
	}
	local, err := service.local()
	if err != nil {
		return nil, err
	}
	directory, err := local.ResolveExisting(input.Directory)
	if err != nil {
		return nil, mapStorageError(err)
	}
	info, err := os.Stat(directory)
	if err != nil || !info.IsDir() {
		return nil, ErrNotFound
	}
	target := filepath.Join(directory, input.Name)
	if existing, statErr := os.Lstat(target); statErr == nil {
		if !input.Overwrite || existing.IsDir() {
			return nil, ErrConflict
		}
	} else if !os.IsNotExist(statErr) {
		return nil, statErr
	}
	id, err := secureID()
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	count := int((input.Size + input.ChunkSize - 1) / input.ChunkSize)
	if input.Size == 0 {
		count = 0
	}
	session := &UploadSession{
		ID:         id,
		Directory:  normalizeLogicalPath(input.Directory),
		Name:       input.Name,
		Size:       input.Size,
		ChunkSize:  input.ChunkSize,
		ChunkCount: count,
		SHA256:     input.SHA256,
		Overwrite:  input.Overwrite,
		CreatedAt:  now,
		ExpiresAt:  now.Add(uploadSessionTTL),
		Received:   []int{},
	}
	sessionDirectory, err := service.sessionDirectory(id)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(sessionDirectory, "chunks"), 0o700); err != nil {
		return nil, err
	}
	if err := service.save(session); err != nil {
		_ = os.RemoveAll(sessionDirectory)
		return nil, err
	}
	return session, nil
}

func (service *ResumableUploadService) Status(id string) (*UploadSession, error) {
	return service.load(id)
}

func (service *ResumableUploadService) WriteChunk(id string, index int, expectedHash string, input io.Reader) error {
	lock := service.lock(id)
	lock.Lock()
	defer lock.Unlock()
	session, err := service.load(id)
	if err != nil {
		return err
	}
	if index < 0 || index >= session.ChunkCount || !validSHA256(expectedHash) {
		return ErrInvalidInput
	}
	expectedSize := session.ChunkSize
	if index == session.ChunkCount-1 {
		expectedSize = session.Size - int64(index)*session.ChunkSize
	}
	sessionDirectory, _ := service.sessionDirectory(id)
	temp, err := os.CreateTemp(filepath.Join(sessionDirectory, "chunks"), ".chunk-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer func() { _ = os.Remove(tempPath) }()
	hash := sha256.New()
	written, err := io.Copy(io.MultiWriter(temp, hash), io.LimitReader(input, expectedSize+1))
	if err != nil {
		_ = temp.Close()
		return err
	}
	if written != expectedSize || hex.EncodeToString(hash.Sum(nil)) != expectedHash {
		_ = temp.Close()
		return ErrInvalidInput
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	chunkPath := filepath.Join(sessionDirectory, "chunks", fmt.Sprintf("%08d", index))
	if err := os.Rename(tempPath, chunkPath); err != nil {
		return err
	}
	if !containsIndex(session.Received, index) {
		session.Received = append(session.Received, index)
		sort.Ints(session.Received)
	}
	return service.save(session)
}

func (service *ResumableUploadService) Complete(id string) error {
	lock := service.lock(id)
	lock.Lock()
	defer lock.Unlock()
	session, err := service.load(id)
	if err != nil {
		return err
	}
	if len(session.Received) != session.ChunkCount {
		return fmt.Errorf("%w: missing chunks", ErrInvalidInput)
	}
	local, err := service.local()
	if err != nil {
		return err
	}
	target, err := local.ResolveForCreate(joinLogical(session.Directory, session.Name))
	if err != nil {
		return mapStorageError(err)
	}
	if err := prepareDestination(target, session.Overwrite); err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(target), ".gofi-assemble-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer func() { _ = os.Remove(tempPath) }()
	hash := sha256.New()
	sessionDirectory, _ := service.sessionDirectory(id)
	for index := 0; index < session.ChunkCount; index++ {
		chunk, err := os.Open(filepath.Join(sessionDirectory, "chunks", fmt.Sprintf("%08d", index)))
		if err != nil {
			_ = temp.Close()
			return ErrInvalidInput
		}
		_, copyErr := io.Copy(io.MultiWriter(temp, hash), chunk)
		_ = chunk.Close()
		if copyErr != nil {
			_ = temp.Close()
			return copyErr
		}
	}
	if hex.EncodeToString(hash.Sum(nil)) != session.SHA256 {
		_ = temp.Close()
		return fmt.Errorf("%w: checksum mismatch", ErrInvalidInput)
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	if err := replacePath(tempPath, target, session.Overwrite); err != nil {
		return err
	}
	if err := syncDirectory(filepath.Dir(target)); err != nil {
		return err
	}
	if service.onChange != nil {
		service.onChange(joinLogical(session.Directory, session.Name))
	}
	return os.RemoveAll(sessionDirectory)
}

func (service *ResumableUploadService) Cancel(id string) error {
	sessionDirectory, err := service.sessionDirectory(id)
	if err != nil {
		return err
	}
	if _, err := os.Stat(sessionDirectory); err != nil {
		return mapStorageError(err)
	}
	return os.RemoveAll(sessionDirectory)
}

func (service *ResumableUploadService) CleanupExpired() error {
	root, err := service.uploadRoot()
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(root)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		session, loadErr := service.load(entry.Name())
		if loadErr != nil || now.After(session.ExpiresAt) {
			_ = os.RemoveAll(filepath.Join(root, entry.Name()))
		}
	}
	return nil
}

func (service *ResumableUploadService) load(id string) (*UploadSession, error) {
	if !validID(id) {
		return nil, ErrInvalidInput
	}
	directory, err := service.sessionDirectory(id)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(directory, "session.json"))
	if err != nil {
		return nil, mapStorageError(err)
	}
	var session UploadSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		_ = os.RemoveAll(directory)
		return nil, ErrNotFound
	}
	return &session, nil
}

func (service *ResumableUploadService) save(session *UploadSession) error {
	directory, err := service.sessionDirectory(session.ID)
	if err != nil {
		return err
	}
	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(directory, ".session-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer func() { _ = os.Remove(tempPath) }()
	if _, err := temp.Write(data); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempPath, filepath.Join(directory, "session.json"))
}

func (service *ResumableUploadService) local() (*localfs.Local, error) {
	root, err := service.configuration.StorageRoot()
	if err != nil {
		return nil, err
	}
	return localfs.NewLocal(root)
}

func (service *ResumableUploadService) uploadRoot() (string, error) {
	local, err := service.local()
	if err != nil {
		return "", err
	}
	root := filepath.Join(local.Root(), ".gofi-uploads")
	if err := os.MkdirAll(root, 0o700); err != nil {
		return "", err
	}
	return root, nil
}

func (service *ResumableUploadService) sessionDirectory(id string) (string, error) {
	if !validID(id) {
		return "", ErrInvalidInput
	}
	root, err := service.uploadRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, id), nil
}

func (service *ResumableUploadService) lock(id string) *sync.Mutex {
	value, _ := service.locks.LoadOrStore(id, &sync.Mutex{})
	return value.(*sync.Mutex)
}

func secureID() (string, error) {
	value := make([]byte, 24)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func validID(value string) bool {
	if len(value) != 48 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func validSHA256(value string) bool {
	if len(value) != sha256.Size*2 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func containsIndex(values []int, expected int) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}
