package middleware

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

//go:embed testdata/static/* testdata/static/assets/*
var staticTestAssets embed.FS

func TestStaticFSCacheHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := gin.New()
	app.Use(StaticFS("/", "testdata/static", staticTestAssets))

	t.Run("root directory index is not cached", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/", nil)
		response := httptest.NewRecorder()
		app.ServeHTTP(response, request)

		require.Equal(t, http.StatusOK, response.Code)
		require.Equal(t, "no-cache, no-store, must-revalidate", response.Header().Get("Cache-Control"))
		require.Equal(t, "no-cache", response.Header().Get("Pragma"))
		require.Equal(t, "0", response.Header().Get("Expires"))
	})

	t.Run("hashed asset remains immutable", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/assets/app-123.js", nil)
		response := httptest.NewRecorder()
		app.ServeHTTP(response, request)

		require.Equal(t, http.StatusOK, response.Code)
		require.Equal(t, "public, max-age=31536000, immutable", response.Header().Get("Cache-Control"))
	})
}
