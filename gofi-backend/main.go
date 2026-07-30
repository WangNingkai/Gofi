package main

import (
	"fmt"
	"gofi/application"
	"gofi/boot"
	"gofi/controller"
	"gofi/db"
	"gofi/env"
	"gofi/extension"
	"gofi/middleware"
	"gofi/tool"
	"net/http"
	"strings"
	"time"

	"gofi/i18n"
	"log"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

func main() {
	boot.ParseArguments()

	if err := i18n.LoadTranslations(); err != nil {
		log.Fatalf("failed to load i18n translations: %v", err)
	}
	app, err := createApp()
	if err != nil {
		log.Fatalf("Gofi 初始化失败: %v", err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			tool.WithError(err).Error("关闭数据库失败")
		}
	}()
	tool.LogStartup(boot.GetArguments().Port, string(env.Current()), db.Version())

	tool.Info("Gofi服务器开始监听端口:", boot.GetArguments().Port)
	if err := app.Run(":" + boot.GetArguments().Port); err != nil {
		log.Fatalf("Gofi服务器启动失败: %v", err)
	}
}

func createApp() (*gin.Engine, error) {
	configureGinMode()
	extension.BindAdditionalType()
	if err := env.EnsureJWTSecret(); err != nil {
		return nil, err
	}

	dataSourceName := tool.GetDatabaseFilePath()
	if env.IsTest() {
		dataSourceName = "file:gofi-test?mode=memory&cache=shared"
	}
	if err := db.Open(dataSourceName, env.IsDevelop() && !env.IsTest()); err != nil {
		return nil, err
	}
	runtimeConfiguration := env.GetConfiguration()
	core := application.New(db.Engine(), runtimeConfiguration)
	handler := controller.NewHandler(core)

	app := gin.New()
	if err := app.SetTrustedProxies(runtimeConfiguration.TrustedProxies); err != nil {
		return nil, fmt.Errorf("configure trusted proxies: %w", err)
	}

	// 注册全局中间件
	globalMiddlewares := []gin.HandlerFunc{
		gin.Recovery(),
		middleware.ErrorHandler(),
		middleware.TraceMiddleware(),
		middleware.IPFilter(),
		middleware.XSSProtection(),
	}
	app.Use(globalMiddlewares...)

	// 添加日志中间件
	config := env.GetConfiguration()
	if config.EnableDebug {
		app.Use(middleware.LoggingMiddlewareWithDetails())
	} else {
		app.Use(middleware.LoggingMiddleware())
	}

	// 预览模式下,限制请求频率
	if env.IsPreview() {
		app.Use(middleware.PerIPRateLimiter(rate.Limit(10), 20))
		// tool.Info(i18n.T(ctx, "main.preview_mode_enabled"), config.MaxRequestsPerMinute, i18n.T(ctx, "main.times_per_minute"))
	}

	app.Use(middleware.CORS)
	app.Use(middleware.Language)

	if !env.IsDevelop() {
		app.Use(middleware.StaticFS("/", "dist", env.EmbedStaticAssets))

		app.NoRoute(func(context *gin.Context) {
			if strings.HasPrefix(context.Request.URL.Path, "/api/") ||
				context.Request.URL.Path == "/api" {
				controller.Failure(
					context,
					http.StatusNotFound,
					controller.StatusNotFound,
					i18n.T(context, "error.not_found"),
				)
				return
			}
			indexBytes, err := env.EmbedStaticAssets.ReadFile("dist/index.html")
			if err != nil {
				controller.Failure(
					context,
					http.StatusInternalServerError,
					controller.StatusInternal,
					i18n.T(context, "error.internal"),
				)
				return
			}
			context.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
			context.String(http.StatusOK, string(indexBytes))
		})
	}

	// 注册API路由（CSRF保护）
	registerAPIRoutes(app, handler)

	return app, nil
}

func configureGinMode() {
	if env.IsTest() {
		gin.SetMode(gin.TestMode)
		return
	}
	if env.IsProduct() || env.IsPreview() {
		gin.SetMode(gin.ReleaseMode)
		return
	}
	gin.SetMode(gin.DebugMode)
}

// registerAPIRoutes 注册API路由
func registerAPIRoutes(app *gin.Engine, handler *controller.Handler) {
	authentication := handler.Application.Authentication
	optionalAuth := middleware.OptionalAuth(authentication)
	requireAuth := middleware.RequireAuth(authentication)
	requireAdmin := middleware.RequireAdmin(authentication)

	api := app.Group("/api")
	{
		if env.GetConfiguration().EnableRateLimit {
			maxRequests := env.GetConfiguration().MaxRequestsPerMinute
			api.Use(middleware.PerIPRateLimiter(
				rate.Every(time.Minute/time.Duration(maxRequests)),
				maxRequests,
			))
		}

		// 基础配置路由
		api.GET("/configuration", handler.GetConfiguration)
		api.POST("/setup", middleware.CSRFProtection(), handler.Setup)
		api.GET("/configuration/details", requireAdmin, handler.GetAdminConfiguration)
		api.POST("/configuration", requireAdmin, middleware.CSRFProtection(), handler.UpdateConfiguration)

		// 文件操作路由
		api.GET("/file", optionalAuth, handler.FetchFile)
		api.GET("/download", optionalAuth, handler.Download)
		api.HEAD("/download", optionalAuth, handler.Download)
		api.POST("/upload", optionalAuth, middleware.CSRFProtection(), handler.Upload)
		api.DELETE("/file", optionalAuth, middleware.CSRFProtection(), handler.DeleteFile)

		// 用户相关路由
		user := api.Group("/user")
		{
			loginHandlers := []gin.HandlerFunc{middleware.CSRFProtection(), handler.Login}
			if env.GetConfiguration().EnableRateLimit {
				loginHandlers = append([]gin.HandlerFunc{
					middleware.PerIPRateLimiter(rate.Every(time.Minute/5), 5),
				}, loginHandlers...)
			}
			user.POST("/login", loginHandlers...)
			user.GET("", requireAuth, handler.GetUser)
			user.POST("/logout", requireAuth, middleware.CSRFProtection(), handler.Logout)
			user.POST("/changePassword", requireAuth, middleware.CSRFProtection(), handler.ChangePassword)
		}

		// 权限管理路由
		permission := api.Group("/permission")
		{
			permission.GET("/guest", handler.GetGuestPermissions)
			permission.POST("/guest", requireAdmin, middleware.CSRFProtection(), handler.UpdateGuestPermissions)
		}
	}
}
