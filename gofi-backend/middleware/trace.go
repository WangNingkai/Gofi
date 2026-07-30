package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"gofi/tool"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	RequestIDKey    = "request_id"
	RequestIDHeader = "X-Request-ID"
)

// TraceMiddleware 为每个请求生成唯一ID并注入到日志上下文
func TraceMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 优先使用客户端传递的 request_id，否则生成新的
		requestID := c.GetHeader(RequestIDHeader)
		if !validRequestID(requestID) {
			requestID = generateRequestID()
		}

		// 设置到 gin 上下文
		c.Set(RequestIDKey, requestID)

		// 设置响应头
		c.Header(RequestIDHeader, requestID)

		// 创建带 request_id 的日志上下文
		logger := tool.WithField("request_id", requestID)
		c.Set("logger", logger)

		c.Next()
	}
}

func validRequestID(value string) bool {
	if value == "" || len(value) > 64 {
		return false
	}
	return strings.IndexFunc(value, func(character rune) bool {
		return !(character >= 'a' && character <= 'z') &&
			!(character >= 'A' && character <= 'Z') &&
			!(character >= '0' && character <= '9') &&
			character != '-' && character != '_'
	}) == -1
}

// GetRequestID 从 gin 上下文获取 request_id
func GetRequestID(c *gin.Context) string {
	if requestID, exists := c.Get(RequestIDKey); exists {
		return requestID.(string)
	}
	return ""
}

// GetLogger 从 gin 上下文获取带 request_id 的 logger
func GetLogger(c *gin.Context) tool.Logger {
	if logger, exists := c.Get("logger"); exists {
		return logger.(tool.Logger)
	}
	return tool.GetLogger()
}

// generateRequestID 生成唯一的请求ID
func generateRequestID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
