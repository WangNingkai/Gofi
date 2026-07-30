package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
)

// LoggingMiddleware 记录请求日志
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// 使用带 request_id 的 logger
		logger := GetLogger(c)

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method

		if raw != "" {
			path = path + "?" + raw
		}

		logger.WithFields(map[string]interface{}{
			"method":     method,
			"path":       path,
			"status":     statusCode,
			"latency":    latency.String(),
			"latency_ms": latency.Milliseconds(),
			"client_ip":  clientIP,
		}).Info("HTTP Request")
	}
}

// LoggingMiddlewareWithDetails 记录不包含请求体、Cookie 或认证头的附加请求信息。
func LoggingMiddlewareWithDetails() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// 使用带 request_id 的 logger
		logger := GetLogger(c)

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method

		if raw != "" {
			path = path + "?" + raw
		}

		logger.WithFields(map[string]interface{}{
			"method":     method,
			"path":       path,
			"status":     statusCode,
			"latency":    latency.String(),
			"latency_ms": latency.Milliseconds(),
			"client_ip":  clientIP,
			"user_agent": c.Request.UserAgent(),
		}).Info("HTTP Request")
	}
}
