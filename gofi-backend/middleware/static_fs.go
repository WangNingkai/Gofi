package middleware

import (
	"embed"
	"gofi/tool"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// StaticFS returns a middleware handler that serves static files in the given directory.
func StaticFS(urlPrefix string, targetPath string, staticAssetsFS embed.FS) gin.HandlerFunc {
	distFS, err := fs.Sub(staticAssetsFS, targetPath)
	if err != nil {
		tool.Fatalf("static.EmbedFolder - Invalid targetPath value - %s", err)
	}

	// 使用标准的 http.FileServer
	fileServer := http.FileServer(http.FS(distFS))

	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") || c.Request.URL.Path == "/api" {
			c.Next()
			return
		}
		filePath := path.Join(".", c.Request.URL.Path)
		staticFile, err := distFS.Open(filePath)

		if err == nil {
			info, statErr := staticFile.Stat()
			_ = staticFile.Close()
			if statErr != nil {
				c.Next()
				return
			}
			addCacheHeaders(c, info.IsDir())
			fileServer.ServeHTTP(c.Writer, c.Request)
			c.Abort()
			return
		}
		// 未命中时不处理，交由后续NoRoute处理（通常fallback到index.html）
	}
}

// addCacheHeaders 为静态文件添加缓存头
func addCacheHeaders(c *gin.Context, servesDirectoryIndex bool) {
	requestPath := c.Request.URL.Path

	// 根据文件类型设置不同的缓存策略
	switch {
	case servesDirectoryIndex || strings.HasSuffix(requestPath, ".html"):
		// HTML 文件不缓存，确保内容更新
		DisableClientCaching(c)
	case strings.HasSuffix(requestPath, ".js") || strings.HasSuffix(requestPath, ".css"):
		// JS/CSS 文件缓存 1 年，文件名通常包含 hash
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	case strings.HasSuffix(requestPath, ".png") || strings.HasSuffix(requestPath, ".jpg") ||
		strings.HasSuffix(requestPath, ".jpeg") || strings.HasSuffix(requestPath, ".gif") ||
		strings.HasSuffix(requestPath, ".svg") || strings.HasSuffix(requestPath, ".ico"):
		// 图片文件缓存 1 个月
		c.Header("Cache-Control", "public, max-age=2592000")
	case strings.HasSuffix(requestPath, ".woff") || strings.HasSuffix(requestPath, ".woff2") ||
		strings.HasSuffix(requestPath, ".ttf") || strings.HasSuffix(requestPath, ".eot"):
		// 字体文件缓存 1 年
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	default:
		// 其他文件缓存 1 小时
		c.Header("Cache-Control", "public, max-age=3600")
	}
}

// DisableClientCaching prevents browsers from retaining HTML entry points.
func DisableClientCaching(c *gin.Context) {
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
}
