package controller

import (
	"net/http"

	"gofi/i18n"
	"gofi/middleware"

	"github.com/gin-gonic/gin"
)

func (handler *Handler) Login(ctx *gin.Context) {
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := ctx.ShouldBindJSON(&input); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	token, err := handler.Application.Authentication.Login(input.Username, input.Password)
	if err != nil {
		WriteApplicationError(ctx, err)
		return
	}

	ctx.SetSameSite(http.SameSiteStrictMode)
	ctx.SetCookie(middleware.SessionCookieName, token, 0, "/api", "", middleware.IsSecureRequest(ctx.Request), true)
	Success(ctx, token)
}

func (handler *Handler) GetUser(ctx *gin.Context) {
	user := middleware.GetCurrentUser(ctx)
	if user == nil {
		WriteApplicationError(ctx, middleware.ErrNoCurrentUser)
		return
	}
	Success(ctx, handler.Application.Authentication.Current(user))
}

func (handler *Handler) ChangePassword(ctx *gin.Context) {
	user := middleware.GetCurrentUser(ctx)
	if user == nil {
		WriteApplicationError(ctx, middleware.ErrNoCurrentUser)
		return
	}
	var input struct {
		CurrentPassword string `json:"currentPassword"`
		Password        string `json:"password"`
		Confirm         string `json:"confirm"`
	}
	if err := ctx.ShouldBindJSON(&input); err != nil {
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
		return
	}
	if err := handler.Application.Authentication.ChangePassword(
		user,
		input.CurrentPassword,
		input.Password,
		input.Confirm,
	); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	ctx.SetSameSite(http.SameSiteStrictMode)
	ctx.SetCookie(middleware.SessionCookieName, "", -1, "/api", "", middleware.IsSecureRequest(ctx.Request), true)
	Success(ctx, nil)
}

func (handler *Handler) Logout(ctx *gin.Context) {
	user := middleware.GetCurrentUser(ctx)
	if user == nil {
		WriteApplicationError(ctx, middleware.ErrNoCurrentUser)
		return
	}
	if err := handler.Application.Authentication.Logout(user); err != nil {
		WriteApplicationError(ctx, err)
		return
	}
	ctx.SetSameSite(http.SameSiteStrictMode)
	ctx.SetCookie(middleware.SessionCookieName, "", -1, "/api", "", middleware.IsSecureRequest(ctx.Request), true)
	Success(ctx, nil)
}
