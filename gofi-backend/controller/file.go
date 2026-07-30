package controller

import (
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"

	"gofi/application"
	"gofi/db"
	"gofi/i18n"
	"gofi/middleware"

	"github.com/gin-gonic/gin"
)

const defaultMemory = 32 << 20

type createDirectoryRequest struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

type renameRequest struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Overwrite bool   `json:"overwrite"`
}

type transferRequest struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Overwrite   bool   `json:"overwrite"`
}

func (handler *Handler) FetchFile(ctx *gin.Context) {
	path := ctx.DefaultQuery("path", "/")
	response, err := handler.Application.Files.Get(path)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}

	permission := db.FilePreview
	if response.Type == "directory" {
		permission = db.FileListPageAccess
	}
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), permission); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, response)
}

func (handler *Handler) Download(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(
		middleware.GetCurrentUser(ctx),
		db.FileDownload,
	); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	download, err := handler.Application.Files.OpenDownload(ctx.DefaultQuery("path", "/"))
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	defer download.Content.Close()

	if ctx.Query("raw") != "true" {
		disposition := mime.FormatMediaType("attachment", map[string]string{"filename": download.Name})
		ctx.Header("Content-Disposition", disposition)
	}
	http.ServeContent(ctx.Writer, ctx.Request, download.Name, download.Modified, download.Content)
}

func (handler *Handler) Upload(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(
		middleware.GetCurrentUser(ctx),
		db.FileUpload,
	); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if err := ctx.Request.ParseMultipartForm(defaultMemory); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	headers := ctx.Request.MultipartForm.File
	files := make([]*multipart.FileHeader, 0)
	for _, group := range headers {
		files = append(files, group...)
	}
	err := handler.Application.Files.Upload(
		ctx.DefaultQuery("path", "/"),
		files,
		ctx.DefaultQuery("overwrite", "false") == "true",
	)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) DeleteFile(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(
		middleware.GetCurrentUser(ctx),
		db.FileRemove,
	); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if err := handler.Application.Files.Delete(ctx.DefaultQuery("path", "/")); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	SuccessMessage(ctx, i18n.T(ctx, "success.delete"))
}

func (handler *Handler) CreateDirectory(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	var request createDirectoryRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	if err := handler.Application.Files.CreateDirectory(request.Path, request.Name); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) RenameFile(ctx *gin.Context) {
	user := middleware.GetCurrentUser(ctx)
	if err := handler.Application.Permissions.Authorize(user, db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if err := handler.Application.Permissions.Authorize(user, db.FileRemove); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	var request renameRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	if err := handler.Application.Files.Rename(request.Path, request.Name, request.Overwrite); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) CopyFile(ctx *gin.Context) {
	handler.transferFile(ctx, false)
}

func (handler *Handler) MoveFile(ctx *gin.Context) {
	handler.transferFile(ctx, true)
}

func (handler *Handler) transferFile(ctx *gin.Context, move bool) {
	user := middleware.GetCurrentUser(ctx)
	if err := handler.Application.Permissions.Authorize(user, db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if move {
		if err := handler.Application.Permissions.Authorize(user, db.FileRemove); err != nil {
			WriteApplicationError(ctx, err)
			return
		}
	}
	var request transferRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	var err error
	if move {
		err = handler.Application.Files.Move(request.Source, request.Destination, request.Overwrite)
	} else {
		err = handler.Application.Files.Copy(request.Source, request.Destination, request.Overwrite)
	}
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) BatchFiles(ctx *gin.Context) {
	user := middleware.GetCurrentUser(ctx)
	if err := handler.Application.Permissions.Authorize(user, db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if err := handler.Application.Permissions.Authorize(user, db.FileRemove); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	var operations []application.BatchFileOperation
	if err := ctx.ShouldBindJSON(&operations); err != nil || len(operations) == 0 || len(operations) > 100 {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	Success(ctx, handler.Application.Files.Batch(operations))
}

func (handler *Handler) CreateUploadSession(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	var input application.CreateUploadSessionInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	session, err := handler.Application.Uploads.Create(input)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, session)
}

func (handler *Handler) GetUploadSession(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	session, err := handler.Application.Uploads.Status(ctx.Param("id"))
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, session)
}

func (handler *Handler) UploadChunk(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	index, err := strconv.Atoi(ctx.Query("index"))
	if err != nil || index < 0 {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	if err := handler.Application.Uploads.WriteChunk(
		ctx.Param("id"),
		index,
		ctx.GetHeader("X-Chunk-SHA256"),
		ctx.Request.Body,
	); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) CompleteUploadSession(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if err := handler.Application.Uploads.Complete(ctx.Param("id")); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) CancelUploadSession(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(middleware.GetCurrentUser(ctx), db.FileUpload); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	if err := handler.Application.Uploads.Cancel(ctx.Param("id")); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}
