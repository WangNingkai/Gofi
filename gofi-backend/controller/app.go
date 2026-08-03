package controller

import (
	"net/http"
	"time"

	"gofi/application"
	"gofi/i18n"
	"gofi/tool"

	"github.com/gin-gonic/gin"
)

func (handler *Handler) GetConfiguration(ctx *gin.Context) {
	configuration, err := handler.Application.Configuration.Public()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, configuration)
}

func (handler *Handler) GetAdminConfiguration(ctx *gin.Context) {
	configuration, err := handler.Application.Configuration.Admin()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, configuration)
}

func (handler *Handler) Setup(ctx *gin.Context) {
	var input application.SetupInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	configuration, err := handler.Application.Configuration.Setup(input)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	handler.rebuildIndexInBackground("setup")
	Success(ctx, configuration)
}

func (handler *Handler) UpdateConfiguration(ctx *gin.Context) {
	var input struct {
		CustomStoragePath string `json:"customStoragePath"`
	}
	if err := ctx.ShouldBindJSON(&input); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	configuration, err := handler.Application.Configuration.UpdateStorage(input.CustomStoragePath)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	handler.rebuildIndexInBackground("storage_update")
	Success(ctx, configuration)
}

func (handler *Handler) rebuildIndexInBackground(reason string) {
	go func() {
		started := time.Now()
		logger := tool.WithField("reason", reason)
		logger.Info("后台文件索引重建开始")
		if err := handler.Application.Index.Rebuild(); err != nil {
			logger.WithError(err).WithField("duration_ms", time.Since(started).Milliseconds()).Warn("后台文件索引重建失败")
			return
		}
		logger.WithField("duration_ms", time.Since(started).Milliseconds()).Info("后台文件索引重建完成")
	}()
}
