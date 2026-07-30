package controller

import (
	"net/http"

	"gofi/db"
	"gofi/i18n"

	"github.com/gin-gonic/gin"
)

func (handler *Handler) GetGuestPermissions(ctx *gin.Context) {
	permissions, err := handler.Application.Permissions.ListGuest()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, permissions)
}

func (handler *Handler) UpdateGuestPermissions(ctx *gin.Context) {
	var permissions []db.Permission
	if err := ctx.ShouldBindJSON(&permissions); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	if err := handler.Application.Permissions.UpdateGuest(permissions); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	updated, err := handler.Application.Permissions.ListGuest()
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	Success(ctx, updated)
}
