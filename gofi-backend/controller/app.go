package controller

import (
	"net/http"

	"gofi/application"
	"gofi/i18n"

	"github.com/gin-gonic/gin"
)

func (handler *Handler) GetConfiguration(ctx *gin.Context) {
	configuration, err := handler.Application.Configuration.Public()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	_ = handler.Application.Index.Rebuild()
	Success(ctx, configuration)
}

func (handler *Handler) GetAdminConfiguration(ctx *gin.Context) {
	configuration, err := handler.Application.Configuration.Admin()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	_ = handler.Application.Index.Rebuild()
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
	Success(ctx, configuration)
}
