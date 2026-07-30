package middleware

import (
	"gofi/tool"
	"net/http"

	"gofi/i18n"

	"github.com/gin-gonic/gin"
)

// ErrorHandler 全局错误处理中间件
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if rec := recover(); rec != nil {
				tool.WithField("panic", rec).Error(i18n.T(c, "error.global_panic"))
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"code":    50000,
					"message": i18n.T(c, "error.internal"),
					"traceId": GetRequestID(c),
				})
			}
		}()
		c.Next()
		// 捕获 gin 上下文中的 error
		errs := c.Errors
		if len(errs) > 0 && !c.Writer.Written() {
			tool.WithField("errors", errs).Warn(i18n.T(c, "error.api_warn"))
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"code":    50000,
				"message": i18n.T(c, "error.internal"),
				"traceId": GetRequestID(c),
			})
			c.Abort()
		}
	}
}
