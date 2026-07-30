package application

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gofi/db"
	"gofi/storage"
	"gofi/tool"
)

const maxInlineTextSize int64 = 1 << 20

type Download struct {
	Name     string
	Modified time.Time
	Content  io.ReadSeekCloser
}

type FileService struct {
	configuration *ConfigurationService
	onChange      func(...string)
}

type FileOperation string

const (
	FileOperationDelete FileOperation = "delete"
	FileOperationCopy   FileOperation = "copy"
	FileOperationMove   FileOperation = "move"
)

type BatchFileOperation struct {
	Operation   FileOperation `json:"operation"`
	Source      string        `json:"source"`
	Destination string        `json:"destination,omitempty"`
	Overwrite   bool          `json:"overwrite,omitempty"`
}

type BatchFileResult struct {
	Source  string `json:"source"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func NewFileService(configuration *ConfigurationService) *FileService {
	return &FileService{configuration: configuration}
}

func (service *FileService) SetChangeHook(hook func(...string)) {
	service.onChange = hook
}

func (service *FileService) notifyChanged(paths ...string) {
	if service.onChange != nil {
		service.onChange(paths...)
	}
}

func (service *FileService) Get(logicalPath string) (*db.FileResponse, error) {
	local, err := service.local()
	if err != nil {
		return nil, err
	}
	absolute, err := local.ResolveExisting(logicalPath)
	if err != nil {
		return nil, mapStorageError(err)
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return nil, mapStorageError(err)
	}
	logicalPath = normalizeLogicalPath(logicalPath)
	if info.IsDir() {
		directory, err := service.readDirectory(local, absolute, logicalPath)
		if err != nil {
			return nil, err
		}
		return &db.FileResponse{Type: "directory", Data: directory}, nil
	}
	file, err := service.readFile(absolute, logicalPath, info)
	if err != nil {
		return nil, err
	}
	return &db.FileResponse{Type: "file", Data: &db.FileData{File: file}}, nil
}

func (service *FileService) OpenDownload(logicalPath string) (*Download, error) {
	local, err := service.local()
	if err != nil {
		return nil, err
	}
	absolute, err := local.ResolveExisting(logicalPath)
	if err != nil {
		return nil, mapStorageError(err)
	}
	file, err := os.Open(absolute)
	if err != nil {
		return nil, mapStorageError(err)
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	if info.IsDir() {
		_ = file.Close()
		return nil, ErrNotFound
	}
	return &Download{Name: info.Name(), Modified: info.ModTime(), Content: file}, nil
}

func (service *FileService) Upload(
	logicalDirectory string,
	headers []*multipart.FileHeader,
	overwrite bool,
) error {
	if len(headers) == 0 {
		return fmt.Errorf("%w: no files supplied", ErrInvalidInput)
	}
	local, err := service.local()
	if err != nil {
		return err
	}
	directory, err := local.ResolveExisting(logicalDirectory)
	if err != nil {
		return mapStorageError(err)
	}
	info, err := os.Stat(directory)
	if err != nil || !info.IsDir() {
		return ErrNotFound
	}

	for _, header := range headers {
		if err := storage.ValidateName(header.Filename); err != nil {
			return fmt.Errorf("%w: invalid file name", ErrInvalidInput)
		}
		finalPath := filepath.Join(directory, header.Filename)
		if existing, statErr := os.Lstat(finalPath); statErr == nil {
			if !overwrite || existing.IsDir() {
				return ErrConflict
			}
		} else if !os.IsNotExist(statErr) {
			return statErr
		}
		if err := writeUploadAtomically(header, finalPath, overwrite); err != nil {
			return err
		}
		service.notifyChanged(joinLogical(normalizeLogicalPath(logicalDirectory), header.Filename))
	}
	return nil
}

func (service *FileService) Delete(logicalPath string) error {
	if normalizeLogicalPath(logicalPath) == "/" {
		return fmt.Errorf("%w: storage root cannot be deleted", ErrInvalidInput)
	}
	local, err := service.local()
	if err != nil {
		return err
	}
	absolute, err := local.ResolveForRemoval(logicalPath)
	if err != nil {
		return mapStorageError(err)
	}
	if err := os.RemoveAll(absolute); err != nil {
		return err
	}
	service.notifyChanged(logicalPath)
	return nil
}

func (service *FileService) CreateDirectory(parent, name string) error {
	if err := storage.ValidateName(name); err != nil {
		return fmt.Errorf("%w: invalid directory name", ErrInvalidInput)
	}
	local, err := service.local()
	if err != nil {
		return err
	}
	parentPath, err := local.ResolveExisting(parent)
	if err != nil {
		return mapStorageError(err)
	}
	info, err := os.Stat(parentPath)
	if err != nil || !info.IsDir() {
		return ErrNotFound
	}
	target, err := local.ResolveForCreate(joinLogical(normalizeLogicalPath(parent), name))
	if err != nil {
		return mapStorageError(err)
	}
	if err := os.Mkdir(target, 0o755); err != nil {
		if os.IsExist(err) {
			return ErrConflict
		}
		return err
	}
	service.notifyChanged(joinLogical(normalizeLogicalPath(parent), name))
	return syncDirectory(parentPath)
}

func (service *FileService) Rename(source, name string, overwrite bool) error {
	if err := storage.ValidateName(name); err != nil {
		return fmt.Errorf("%w: invalid name", ErrInvalidInput)
	}
	parent := normalizeLogicalPath(filepath.ToSlash(filepath.Dir(source)))
	return service.Move(source, joinLogical(parent, name), overwrite)
}

func (service *FileService) Copy(source, destination string, overwrite bool) error {
	_, sourcePath, destinationPath, err := service.operationPaths(source, destination)
	if err != nil {
		return err
	}
	if err := rejectNestedDestination(sourcePath, destinationPath); err != nil {
		return err
	}
	if err := prepareDestination(destinationPath, overwrite); err != nil {
		return err
	}
	tempPath := destinationPath + ".gofi-copy-" + randomSuffix()
	defer func() { _ = os.RemoveAll(tempPath) }()
	if err := copyEntry(sourcePath, tempPath); err != nil {
		return err
	}
	if err := replacePath(tempPath, destinationPath, overwrite); err != nil {
		return err
	}
	service.notifyChanged(destination)
	return syncDirectory(filepath.Dir(destinationPath))
}

func (service *FileService) Move(source, destination string, overwrite bool) error {
	_, sourcePath, destinationPath, err := service.operationPaths(source, destination)
	if err != nil {
		return err
	}
	if sourcePath == destinationPath {
		return nil
	}
	if err := rejectNestedDestination(sourcePath, destinationPath); err != nil {
		return err
	}
	if err := prepareDestination(destinationPath, overwrite); err != nil {
		return err
	}
	if err := replacePath(sourcePath, destinationPath, overwrite); err == nil {
		service.notifyChanged(source, destination)
		return syncDirectory(filepath.Dir(destinationPath))
	}
	// 跨文件系统移动退化为完整复制，目标落盘后才删除源。
	if err := service.Copy(source, destination, overwrite); err != nil {
		return err
	}
	if err := os.RemoveAll(sourcePath); err != nil {
		_ = os.RemoveAll(destinationPath)
		return err
	}
	service.notifyChanged(source, destination)
	return syncDirectory(filepath.Dir(sourcePath))
}

func (service *FileService) Batch(operations []BatchFileOperation) []BatchFileResult {
	results := make([]BatchFileResult, 0, len(operations))
	for _, operation := range operations {
		var err error
		switch operation.Operation {
		case FileOperationDelete:
			err = service.Delete(operation.Source)
		case FileOperationCopy:
			err = service.Copy(operation.Source, operation.Destination, operation.Overwrite)
		case FileOperationMove:
			err = service.Move(operation.Source, operation.Destination, operation.Overwrite)
		default:
			err = fmt.Errorf("%w: unknown file operation", ErrInvalidInput)
		}
		result := BatchFileResult{Source: operation.Source, Success: err == nil}
		if err != nil {
			result.Error = publicErrorName(err)
		}
		results = append(results, result)
	}
	return results
}

func (service *FileService) operationPaths(source, destination string) (*storage.Local, string, string, error) {
	if normalizeLogicalPath(source) == "/" || normalizeLogicalPath(destination) == "/" {
		return nil, "", "", fmt.Errorf("%w: storage root cannot be moved", ErrInvalidInput)
	}
	local, err := service.local()
	if err != nil {
		return nil, "", "", err
	}
	sourcePath, err := local.ResolveForRemoval(source)
	if err != nil {
		return nil, "", "", mapStorageError(err)
	}
	destinationPath, err := local.ResolveForCreate(destination)
	if err != nil {
		return nil, "", "", mapStorageError(err)
	}
	parent, err := local.ResolveExisting(filepath.ToSlash(filepath.Dir(destination)))
	if err != nil {
		return nil, "", "", mapStorageError(err)
	}
	info, err := os.Stat(parent)
	if err != nil || !info.IsDir() {
		return nil, "", "", ErrNotFound
	}
	return local, sourcePath, destinationPath, nil
}

func (service *FileService) local() (*storage.Local, error) {
	root, err := service.configuration.StorageRoot()
	if err != nil {
		return nil, err
	}
	return storage.NewLocal(root)
}

func (service *FileService) readDirectory(
	local *storage.Local,
	absolute string,
	logical string,
) (*db.DirectoryData, error) {
	entries, err := os.ReadDir(absolute)
	if err != nil {
		return nil, err
	}
	files := make([]db.File, 0, len(entries))
	for _, entry := range entries {
		if tool.IsHiddenFile(entry.Name()) {
			continue
		}
		childLogical := joinLogical(logical, entry.Name())
		childAbsolute, err := local.ResolveExisting(childLogical)
		if err != nil {
			continue
		}
		info, err := os.Stat(childAbsolute)
		if err != nil {
			continue
		}
		files = append(files, buildFile(info, childLogical, childAbsolute, ""))
	}
	return &db.DirectoryData{Path: logical, Files: files}, nil
}

func (service *FileService) readFile(
	absolute string,
	logical string,
	info os.FileInfo,
) (db.File, error) {
	content := ""
	if info.Size() <= maxInlineTextSize && tool.IsTextFile(absolute) {
		bytes, err := os.ReadFile(absolute)
		if err != nil {
			return db.File{}, err
		}
		content = string(bytes)
	}
	return buildFile(info, logical, absolute, content), nil
}

func buildFile(info os.FileInfo, logical, absolute, content string) db.File {
	extension := strings.TrimPrefix(filepath.Ext(info.Name()), ".")
	mimeType := mime.TypeByExtension(filepath.Ext(info.Name()))
	fileType, iconType := tool.GetFileTypeByName(info.Name())
	if info.IsDir() {
		fileType, iconType = "directory", "folder"
	} else if fileType == "other" {
		fileType, iconType = tool.GetFileType(extension, mimeType, tool.IsTextFile(absolute))
	}
	return db.File{
		Name:         info.Name(),
		IsDirectory:  info.IsDir(),
		Size:         int(info.Size()),
		Extension:    extension,
		Mime:         mimeType,
		Path:         logical,
		LastModified: info.ModTime().Unix(),
		Content:      content,
		FileType:     fileType,
		IconType:     iconType,
	}
}

func writeUploadAtomically(header *multipart.FileHeader, finalPath string, overwrite bool) error {
	source, err := header.Open()
	if err != nil {
		return err
	}
	defer source.Close()

	temp, err := os.CreateTemp(filepath.Dir(finalPath), ".gofi-upload-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer func() { _ = os.Remove(tempPath) }()

	if _, err := io.Copy(temp, source); err != nil {
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
	if !overwrite {
		return os.Rename(tempPath, finalPath)
	}

	// Unix 可以直接原子替换；不支持替换的文件系统使用备份并在失败时回滚。
	if err := os.Rename(tempPath, finalPath); err == nil {
		return nil
	}
	backup, err := os.CreateTemp(filepath.Dir(finalPath), ".gofi-backup-*")
	if err != nil {
		return err
	}
	backupPath := backup.Name()
	if err := backup.Close(); err != nil {
		return err
	}
	if err := os.Remove(backupPath); err != nil {
		return err
	}
	defer func() { _ = os.Remove(backupPath) }()

	if err := os.Rename(finalPath, backupPath); err != nil {
		return err
	}
	if err := os.Rename(tempPath, finalPath); err != nil {
		_ = os.Rename(backupPath, finalPath)
		return err
	}
	return os.Remove(backupPath)
}

func prepareDestination(path string, overwrite bool) error {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !overwrite || info.IsDir() {
		return ErrConflict
	}
	return nil
}

func replacePath(source, destination string, overwrite bool) error {
	if !overwrite {
		if _, err := os.Lstat(destination); err == nil {
			return ErrConflict
		} else if !os.IsNotExist(err) {
			return err
		}
		return os.Rename(source, destination)
	}
	if err := os.Rename(source, destination); err == nil {
		return nil
	}
	backup := destination + ".gofi-backup-" + randomSuffix()
	if _, err := os.Lstat(destination); os.IsNotExist(err) {
		return os.Rename(source, destination)
	} else if err != nil {
		return err
	}
	if err := os.Rename(destination, backup); err != nil {
		return err
	}
	if err := os.Rename(source, destination); err != nil {
		_ = os.Rename(backup, destination)
		return err
	}
	return os.RemoveAll(backup)
}

func copyEntry(source, destination string) error {
	info, err := os.Lstat(source)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return ErrForbidden
	}
	if info.IsDir() {
		if err := os.Mkdir(destination, info.Mode().Perm()); err != nil {
			return err
		}
		entries, err := os.ReadDir(source)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			if err := copyEntry(filepath.Join(source, entry.Name()), filepath.Join(destination, entry.Name())); err != nil {
				return err
			}
		}
		return syncDirectory(destination)
	}
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, info.Mode().Perm())
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		_ = output.Close()
		return err
	}
	if err := output.Sync(); err != nil {
		_ = output.Close()
		return err
	}
	return output.Close()
}

func rejectNestedDestination(source, destination string) error {
	info, err := os.Lstat(source)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return nil
	}
	relative, err := filepath.Rel(source, destination)
	if err == nil && relative != "." && relative != ".." &&
		!strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return fmt.Errorf("%w: destination is inside source", ErrInvalidInput)
	}
	return nil
}

func syncDirectory(path string) error {
	directory, err := os.Open(path)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}

func randomSuffix() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func publicErrorName(err error) string {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return "invalid_input"
	case errors.Is(err, ErrForbidden):
		return "forbidden"
	case errors.Is(err, ErrNotFound):
		return "not_found"
	case errors.Is(err, ErrConflict):
		return "conflict"
	default:
		return "internal"
	}
}

func mapStorageError(err error) error {
	switch {
	case errors.Is(err, storage.ErrInvalidPath), errors.Is(err, storage.ErrPathEscape):
		return ErrForbidden
	case os.IsNotExist(err):
		return ErrNotFound
	default:
		return err
	}
}

func normalizeLogicalPath(value string) string {
	value = strings.ReplaceAll(value, `\`, "/")
	if value == "" {
		return "/"
	}
	cleaned := filepath.ToSlash(filepath.Clean("/" + strings.TrimPrefix(value, "/")))
	return cleaned
}

func joinLogical(parent, name string) string {
	if parent == "/" {
		return "/" + name
	}
	return strings.TrimSuffix(parent, "/") + "/" + name
}
