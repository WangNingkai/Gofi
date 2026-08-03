package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gofi/env"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCORSAllowsResumableUploadPut(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := gin.New()
	app.Use(CORS)
	app.PUT("/api/upload/session/:id/chunk", func(ctx *gin.Context) { ctx.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodOptions, "http://files.example/api/upload/session/id/chunk", nil)
	request.Host = "files.example"
	request.Header.Set("Origin", "http://files.example")
	response := httptest.NewRecorder()
	app.ServeHTTP(response, request)

	require.Equal(t, http.StatusNoContent, response.Code)
	require.Contains(t, strings.Split(response.Header().Get("Access-Control-Allow-Methods"), ", "), http.MethodPut)
}

func TestForwardedSchemeRequiresTrustedProxy(t *testing.T) {
	configuration := env.GetConfiguration()
	original := append([]string(nil), configuration.TrustedProxies...)
	t.Cleanup(func() { configuration.TrustedProxies = original })
	configuration.TrustedProxies = []string{"127.0.0.1"}

	trusted := httptest.NewRequest(http.MethodPost, "http://files.example/api/user/login", nil)
	trusted.RemoteAddr = "127.0.0.1:43100"
	trusted.Header.Set("X-Forwarded-Proto", "https")
	require.True(t, IsSecureRequest(trusted))
	require.True(t, originAllowed(trusted, "https://files.example"))

	untrusted := httptest.NewRequest(http.MethodPost, "http://files.example/api/user/login", nil)
	untrusted.RemoteAddr = "203.0.113.10:43100"
	untrusted.Header.Set("X-Forwarded-Proto", "https")
	require.False(t, IsSecureRequest(untrusted))
	require.False(t, originAllowed(untrusted, "https://files.example"))
}
