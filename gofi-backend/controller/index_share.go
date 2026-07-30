package controller

import (
	"mime"
	"net/http"
	"strconv"

	"gofi/db"
	"gofi/i18n"
	"gofi/middleware"

	"github.com/gin-gonic/gin"
)

type createShareRequest struct {
	Path           string `json:"path"`
	ExpiresInHours int    `json:"expiresInHours"`
}

func (handler *Handler) SearchFiles(ctx *gin.Context) {
	if err := handler.Application.Permissions.Authorize(
		middleware.GetCurrentUser(ctx),
		db.FileListPageAccess,
	); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	results, err := handler.Application.Index.Search(
		ctx.Query("q"),
		ctx.Query("content") == "true",
		limit,
	)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, results)
}

func (handler *Handler) RebuildIndex(ctx *gin.Context) {
	if err := handler.Application.Index.Rebuild(); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) CreateShare(ctx *gin.Context) {
	var request createShareRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	share, err := handler.Application.Shares.Create(request.Path, request.ExpiresInHours)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, share)
}

func (handler *Handler) ListShares(ctx *gin.Context) {
	shares, err := handler.Application.Shares.List()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, shares)
}

func (handler *Handler) RevokeShare(ctx *gin.Context) {
	id, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil || id < 1 {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	if err := handler.Application.Shares.Revoke(id); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, nil)
}

func (handler *Handler) FetchSharedFile(ctx *gin.Context) {
	logical, err := handler.Application.Shares.Resolve(ctx.Param("token"), ctx.Query("path"))
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	response, err := handler.Application.Files.Get(logical)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, response)
}

func (handler *Handler) DownloadSharedFile(ctx *gin.Context) {
	logical, err := handler.Application.Shares.Resolve(ctx.Param("token"), ctx.Query("path"))
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	download, err := handler.Application.Files.OpenDownload(logical)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	defer download.Content.Close()
	if ctx.Query("raw") != "true" {
		ctx.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": download.Name}))
	}
	http.ServeContent(ctx.Writer, ctx.Request, download.Name, download.Modified, download.Content)
}
