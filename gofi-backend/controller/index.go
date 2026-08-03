package controller

import (
	"strconv"

	"gofi/db"
	"gofi/middleware"

	"github.com/gin-gonic/gin"
)

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
