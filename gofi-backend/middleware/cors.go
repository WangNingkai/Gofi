package middleware

import (
	"net"
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
		ctx.Header("Access-Control-Allow-Methods", "POST, PUT, OPTIONS, GET, HEAD, DELETE")
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
	requestScheme := effectiveRequestScheme(request)
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

// IsSecureRequest reports the client-facing scheme. Forwarded headers are only
// accepted when the direct peer is explicitly configured as a trusted proxy.
func IsSecureRequest(request *http.Request) bool {
	return effectiveRequestScheme(request) == "https"
}

func effectiveRequestScheme(request *http.Request) string {
	if request.TLS != nil {
		return "https"
	}
	if !requestFromTrustedProxy(request) {
		return "http"
	}
	forwarded := strings.TrimSpace(strings.Split(request.Header.Get("X-Forwarded-Proto"), ",")[0])
	if strings.EqualFold(forwarded, "https") {
		return "https"
	}
	return "http"
}

func requestFromTrustedProxy(request *http.Request) bool {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		host = request.RemoteAddr
	}
	return isIPInList(host, env.GetConfiguration().TrustedProxies)
}
