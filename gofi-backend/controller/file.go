package controller

import (
	"mime"
	"mime/multipart"
	"net/http"

	"gofi/db"
	"gofi/i18n"
	"gofi/middleware"

	"github.com/gin-gonic/gin"
)

const defaultMemory = 32 << 20

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
