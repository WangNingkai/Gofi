package middleware

import (
	"github.com/gin-gonic/gin"
)

func abortWithError(ctx *gin.Context, status, code int, message string) {
	ctx.AbortWithStatusJSON(status, gin.H{
		"success": false,
		"code":    code,
		"message": message,
		"traceId": GetRequestID(ctx),
	})
}
