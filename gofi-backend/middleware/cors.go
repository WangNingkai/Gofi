package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"gofi/env"

	"github.com/gin-gonic/gin"
)

func CORS(ctx *gin.Context) {
	origin := strings.TrimSpace(ctx.GetHeader("Origin"))
	if origin != "" && originAllowed(ctx.Request, origin) {
		ctx.Header("Access-Control-Allow-Origin", origin)
		ctx.Header("Vary", "Origin")
		ctx.Header("Access-Control-Allow-Credentials", "true")
		ctx.Header("Access-Control-Allow-Headers", "Content-Type, Accept-Language, Authorization")
		ctx.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, HEAD, DELETE")
	}

	if ctx.Request.Method == http.MethodOptions {
		if origin == "" || !originAllowed(ctx.Request, origin) {
			ctx.AbortWithStatus(http.StatusForbidden)
			return
		}
		ctx.AbortWithStatus(http.StatusNoContent)
		return
	}
	ctx.Next()
}

func originAllowed(request *http.Request, origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}
	requestScheme := "http"
	if request.TLS != nil {
		requestScheme = "https"
	}
	if strings.EqualFold(parsed.Scheme+"://"+parsed.Host, requestScheme+"://"+request.Host) {
		return true
	}
	for _, allowed := range env.GetConfiguration().AllowedOrigins {
		if strings.EqualFold(strings.TrimSuffix(allowed, "/"), strings.TrimSuffix(origin, "/")) {
			return true
		}
	}
	return false
}
