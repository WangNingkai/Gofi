package controller

import (
	"errors"
	"net/http"

	"gofi/application"
	"gofi/i18n"
	"gofi/middleware"
	"gofi/tool"

	"github.com/gin-gonic/gin"
)

type Resource struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Code    int         `json:"code"`
	Data    interface{} `json:"data,omitempty"`
	TraceID string      `json:"traceId,omitempty"`
}

const (
	StatusOk                        = 200
	StatusUnknown                   = -1
	StatusNotFound                  = 404
	StatusTokenMiss                 = 10000
	StatusTokenInvalid              = 10001
	StatusTokenExpired              = 10002
	StatusUsernameOrPasswordIsWrong = 10003
	StatusForbidden                 = 10004
	StatusAlreadyInitialized        = 20000
	StatusNotInitialized            = 20001
	StatusCurrentIsPreviewMode      = 20002
	StatusDirNotExist               = 30000
	StatusFileNotExist              = 30001
	StatusUploadFileFailed          = 30002
	StatusCantOverwriteFile         = 30003
	StatusInvalidRequest            = 40000
	StatusInternal                  = 50000
)

func Success(ctx *gin.Context, data interface{}) {
	ctx.JSON(http.StatusOK, Resource{
		Success: true,
		Code:    StatusOk,
		Data:    data,
		TraceID: middleware.GetRequestID(ctx),
	})
}

func SuccessMessage(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusOK, Resource{
		Success: true,
		Code:    StatusOk,
		Message: message,
		TraceID: middleware.GetRequestID(ctx),
	})
}

func Failure(ctx *gin.Context, status int, code int, message string) {
	ctx.AbortWithStatusJSON(status, Resource{
		Success: false,
		Code:    code,
		Message: message,
		TraceID: middleware.GetRequestID(ctx),
	})
}

func WriteApplicationError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, application.ErrUnauthenticated):
		Failure(ctx, http.StatusUnauthorized, StatusTokenInvalid, i18n.T(ctx, "auth.not_authorized"))
	case errors.Is(err, application.ErrForbidden):
		Failure(ctx, http.StatusForbidden, StatusForbidden, i18n.T(ctx, "auth.insufficient_permissions"))
	case errors.Is(err, application.ErrNotFound):
		Failure(ctx, http.StatusNotFound, StatusNotFound, i18n.T(ctx, "error.not_found"))
	case errors.Is(err, application.ErrConflict):
		Failure(ctx, http.StatusConflict, StatusCantOverwriteFile, i18n.T(ctx, "error.conflict"))
	case errors.Is(err, application.ErrAlreadyInitialized):
		Failure(ctx, http.StatusConflict, StatusAlreadyInitialized, i18n.T(ctx, "error.already_initialized"))
	case errors.Is(err, application.ErrNotInitialized):
		Failure(ctx, http.StatusConflict, StatusNotInitialized, i18n.T(ctx, "error.not_initialized"))
	case errors.Is(err, application.ErrPreviewReadOnly):
		Failure(ctx, http.StatusForbidden, StatusCurrentIsPreviewMode, i18n.T(ctx, "error.operation_not_allowed_preview"))
	case errors.Is(err, application.ErrInvalidCredentials):
		Failure(ctx, http.StatusUnauthorized, StatusUsernameOrPasswordIsWrong, i18n.T(ctx, "user.invalid_credentials"))
	case errors.Is(err, application.ErrInvalidInput):
		Failure(ctx, http.StatusBadRequest, StatusInvalidRequest, i18n.T(ctx, "error.invalid_request"))
	default:
		tool.WithError(err).WithFields(map[string]interface{}{
			"request_id": middleware.GetRequestID(ctx),
			"method":     ctx.Request.Method,
			"route":      ctx.FullPath(),
		}).Error("应用请求处理失败")
		Failure(ctx, http.StatusInternalServerError, StatusInternal, i18n.T(ctx, "error.internal"))
	}
}
