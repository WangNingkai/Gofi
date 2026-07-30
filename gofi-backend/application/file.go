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
}

func NewFileService(configuration *ConfigurationService) *FileService {
	return &FileService{configuration: configuration}
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
	return nil
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
