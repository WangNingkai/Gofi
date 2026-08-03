package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"gofi/application"
	"gofi/controller"
	"gofi/db"
	"gofi/env"
	"gofi/i18n"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type testResponse struct {
	Success bool            `json:"success"`
	Code    int             `json:"code"`
	Data    json.RawMessage `json:"data"`
	TraceID string          `json:"traceId"`
}

func TestCoreHTTPFlow(t *testing.T) {
	require.True(t, env.IsTest())
	require.NoError(t, i18n.LoadTranslations())

	app, err := createApp()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	storageDir := t.TempDir()
	const adminPassword = "local-test-password"

	t.Run("公开配置不暴露本地路径", func(t *testing.T) {
		status, response := performRequest(t, app, http.MethodGet, "/api/configuration", nil, "")
		require.Equal(t, http.StatusOK, status)
		require.True(t, response.Success)
		require.NotContains(t, string(response.Data), "StoragePath")
	})

	t.Run("初始化必须创建非默认管理员凭据", func(t *testing.T) {
		status, response := performRequest(t, app, http.MethodPost, "/api/setup", map[string]string{
			"customStoragePath": storageDir,
			"adminUsername":     "owner",
			"adminPassword":     adminPassword,
		}, "")
		require.Equal(t, http.StatusOK, status)
		require.True(t, response.Success)

		status, response = performRequest(t, app, http.MethodPost, "/api/setup", map[string]string{
			"adminUsername": "another",
			"adminPassword": "another-secure-password",
		}, "")
		require.Equal(t, http.StatusConflict, status)
		require.Equal(t, controller.StatusAlreadyInitialized, response.Code)
	})

	t.Run("错误凭据返回 401", func(t *testing.T) {
		status, response := performRequest(t, app, http.MethodPost, "/api/user/login", map[string]string{
			"username": "owner",
			"password": "wrong-password",
		}, "")
		require.Equal(t, http.StatusUnauthorized, status)
		require.Equal(t, controller.StatusUsernameOrPasswordIsWrong, response.Code)
	})

	var token string
	t.Run("管理员登录", func(t *testing.T) {
		status, response := performRequest(t, app, http.MethodPost, "/api/user/login", map[string]string{
			"username": "owner",
			"password": adminPassword,
		}, "")
		require.Equal(t, http.StatusOK, status)
		require.NoError(t, json.Unmarshal(response.Data, &token))
		require.NotEmpty(t, token)
	})

	t.Run("读取配置不会同步重建文件索引", func(t *testing.T) {
		// 等待初始化触发的后台重建完成，再创建一个尚未进入索引的文件。
		status, _ := performRequest(t, app, http.MethodPost, "/api/search/rebuild", nil, token)
		require.Equal(t, http.StatusOK, status)
		require.NoError(t, os.WriteFile(filepath.Join(storageDir, "not-indexed-by-config.txt"), []byte("sentinel"), 0o600))

		status, _ = performRequest(t, app, http.MethodGet, "/api/configuration", nil, "")
		require.Equal(t, http.StatusOK, status)
		status, response := performRequest(t, app, http.MethodGet, "/api/search?q=not-indexed-by-config", nil, token)
		require.Equal(t, http.StatusOK, status)
		var results []db.FileIndex
		require.NoError(t, json.Unmarshal(response.Data, &results))
		require.Empty(t, results)
		require.NoError(t, os.Remove(filepath.Join(storageDir, "not-indexed-by-config.txt")))
	})

	t.Run("登录 Cookie 可以访问受保护资源", func(t *testing.T) {
		body, err := json.Marshal(map[string]string{
			"username": "owner",
			"password": adminPassword,
		})
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		app.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusOK, recorder.Code)

		cookies := recorder.Result().Cookies()
		require.NotEmpty(t, cookies)
		userRequest := httptest.NewRequest(http.MethodGet, "/api/user", nil)
		userRequest.AddCookie(cookies[0])
		userRecorder := httptest.NewRecorder()
		app.ServeHTTP(userRecorder, userRequest)
		require.Equal(t, http.StatusOK, userRecorder.Code)
	})

	t.Run("可信 HTTPS 代理下登录 Cookie 标记为 Secure", func(t *testing.T) {
		configuration := env.GetConfiguration()
		original := append([]string(nil), configuration.TrustedProxies...)
		configuration.TrustedProxies = []string{"192.0.2.1"}
		t.Cleanup(func() { configuration.TrustedProxies = original })

		body, err := json.Marshal(map[string]string{
			"username": "owner",
			"password": adminPassword,
		})
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-Forwarded-Proto", "https")
		recorder := httptest.NewRecorder()
		app.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusOK, recorder.Code)

		cookies := recorder.Result().Cookies()
		require.NotEmpty(t, cookies)
		require.True(t, cookies[0].Secure)
	})

	t.Run("文件权限与路径边界", func(t *testing.T) {
		require.NoError(t, os.WriteFile(filepath.Join(storageDir, "hello.txt"), []byte("hello"), 0o600))

		status, _ := performRequest(t, app, http.MethodGet, "/api/file?path=/", nil, "")
		require.Equal(t, http.StatusUnauthorized, status)

		status, response := performRequest(t, app, http.MethodGet, "/api/file?path=/", nil, token)
		require.Equal(t, http.StatusOK, status)
		require.True(t, response.Success)

		target := "/api/file?path=" + url.QueryEscape("/../outside")
		status, _ = performRequest(t, app, http.MethodGet, target, nil, token)
		require.Equal(t, http.StatusForbidden, status)

		if runtime.GOOS != "windows" {
			outside := t.TempDir()
			require.NoError(t, os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("secret"), 0o600))
			require.NoError(t, os.Symlink(outside, filepath.Join(storageDir, "escape")))
			status, _ = performRequest(
				t,
				app,
				http.MethodGet,
				"/api/file?path="+url.QueryEscape("/escape/secret.txt"),
				nil,
				token,
			)
			require.Equal(t, http.StatusForbidden, status)
		}
	})

	t.Run("上传覆盖与删除闭环", func(t *testing.T) {
		status := performMultipartUpload(t, app, "/api/upload?path=/", "upload.txt", "first", token)
		require.Equal(t, http.StatusOK, status)
		require.FileExists(t, filepath.Join(storageDir, "upload.txt"))

		status = performMultipartUpload(
			t,
			app,
			"/api/upload?path=/&overwrite=true",
			"upload.txt",
			"second",
			token,
		)
		require.Equal(t, http.StatusOK, status)
		content, err := os.ReadFile(filepath.Join(storageDir, "upload.txt"))
		require.NoError(t, err)
		require.Equal(t, "second", string(content))

		status, _ = performRequest(
			t,
			app,
			http.MethodDelete,
			"/api/file?path="+url.QueryEscape("/upload.txt"),
			nil,
			token,
		)
		require.Equal(t, http.StatusOK, status)
		_, err = os.Stat(filepath.Join(storageDir, "upload.txt"))
		require.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("目录与文件操作闭环", func(t *testing.T) {
		status, _ := performRequest(t, app, http.MethodPost, "/api/directory", map[string]interface{}{
			"path": "/", "name": "managed",
		}, token)
		require.Equal(t, http.StatusOK, status)
		require.NoError(t, os.WriteFile(filepath.Join(storageDir, "managed", "source.txt"), []byte("managed"), 0o600))

		status, _ = performRequest(t, app, http.MethodPost, "/api/file/copy", map[string]interface{}{
			"source": "/managed/source.txt", "destination": "/managed/copy.txt",
		}, token)
		require.Equal(t, http.StatusOK, status)
		status, _ = performRequest(t, app, http.MethodPost, "/api/file/rename", map[string]interface{}{
			"path": "/managed/copy.txt", "name": "renamed.txt",
		}, token)
		require.Equal(t, http.StatusOK, status)
		status, _ = performRequest(t, app, http.MethodPost, "/api/file/move", map[string]interface{}{
			"source": "/managed/renamed.txt", "destination": "/moved-managed.txt",
		}, token)
		require.Equal(t, http.StatusOK, status)

		status, response := performRequest(t, app, http.MethodPost, "/api/file/batch", []map[string]interface{}{
			{"operation": "delete", "source": "/moved-managed.txt"},
			{"operation": "delete", "source": "/does-not-exist"},
		}, token)
		require.Equal(t, http.StatusOK, status)
		var results []application.BatchFileResult
		require.NoError(t, json.Unmarshal(response.Data, &results))
		require.True(t, results[0].Success)
		require.False(t, results[1].Success)
	})

	t.Run("索引搜索与可撤销分享", func(t *testing.T) {
		status, _ := performRequest(t, app, http.MethodPost, "/api/search/rebuild", nil, token)
		require.Equal(t, http.StatusOK, status)
		status, response := performRequest(t, app, http.MethodGet, "/api/search?q=hello", nil, token)
		require.Equal(t, http.StatusOK, status)
		var searchResults []db.FileIndex
		require.NoError(t, json.Unmarshal(response.Data, &searchResults))
		require.NotEmpty(t, searchResults)

		status, response = performRequest(t, app, http.MethodGet, "/api/share", nil, token)
		require.Equal(t, http.StatusOK, status)
		var initialShares []db.Share
		require.NoError(t, json.Unmarshal(response.Data, &initialShares))
		require.Empty(t, initialShares)

		status, response = performRequest(t, app, http.MethodPost, "/api/share", map[string]interface{}{
			"path": "/hello.txt", "expiresInHours": 24,
		}, token)
		require.Equal(t, http.StatusOK, status)
		var share application.CreatedShare
		require.NoError(t, json.Unmarshal(response.Data, &share))
		require.NotEmpty(t, share.Token)

		status, response = performRequest(t, app, http.MethodGet, "/api/share", nil, token)
		require.Equal(t, http.StatusOK, status)
		var shares []db.Share
		require.NoError(t, json.Unmarshal(response.Data, &shares))
		require.Len(t, shares, 1)
		require.Equal(t, share.ID, shares[0].ID)

		status, _ = performRequest(t, app, http.MethodGet, "/api/shared/"+share.Token, nil, "")
		require.Equal(t, http.StatusOK, status)
		status, _ = performRequest(t, app, http.MethodDelete, fmt.Sprintf("/api/share/%d", share.ID), nil, token)
		require.Equal(t, http.StatusOK, status)
		status, _ = performRequest(t, app, http.MethodGet, "/api/shared/"+share.Token, nil, "")
		require.Equal(t, http.StatusNotFound, status)
	})

	t.Run("管理员可以显式开放访客目录权限", func(t *testing.T) {
		status, response := performRequest(t, app, http.MethodPost, "/api/permission/guest", []map[string]interface{}{
			{"name": db.FileListPageAccess, "enable": true},
		}, token)
		require.Equal(t, http.StatusOK, status)
		require.True(t, response.Success)

		status, _ = performRequest(t, app, http.MethodGet, "/api/file?path=/", nil, "")
		require.Equal(t, http.StatusOK, status)
		status, _ = performRequest(t, app, http.MethodGet, "/api/download?path=/hello.txt", nil, "")
		require.Equal(t, http.StatusUnauthorized, status)
	})

	t.Run("访客预览与下载权限相互独立", func(t *testing.T) {
		status, _ := performRequest(t, app, http.MethodPost, "/api/permission/guest", []map[string]interface{}{
			{"name": db.FilePreview, "enable": true},
		}, token)
		require.Equal(t, http.StatusOK, status)

		status, _ = performRequest(
			t,
			app,
			http.MethodGet,
			"/api/file?path="+url.QueryEscape("/hello.txt"),
			nil,
			"",
		)
		require.Equal(t, http.StatusOK, status)
		status, _ = performRequest(t, app, http.MethodGet, "/api/download?path=/hello.txt", nil, "")
		require.Equal(t, http.StatusUnauthorized, status)
	})

	t.Run("跨源写请求被 CSRF 保护拒绝", func(t *testing.T) {
		body, err := json.Marshal(map[string]string{"customStoragePath": storageDir})
		require.NoError(t, err)
		request := httptest.NewRequest(http.MethodPost, "/api/configuration", bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+token)
		request.Header.Set("Origin", "https://example.invalid")
		recorder := httptest.NewRecorder()
		app.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusForbidden, recorder.Code)
	})

	t.Run("改密撤销旧会话", func(t *testing.T) {
		status, response := performRequest(t, app, http.MethodPost, "/api/user/changePassword", map[string]string{
			"currentPassword": adminPassword,
			"password":        "new-local-password",
			"confirm":         "new-local-password",
		}, token)
		require.Equal(t, http.StatusOK, status)
		require.True(t, response.Success)

		status, _ = performRequest(t, app, http.MethodGet, "/api/user", nil, token)
		require.Equal(t, http.StatusUnauthorized, status)
	})
}

func performMultipartUpload(
	t *testing.T,
	app *gin.Engine,
	target string,
	name string,
	content string,
	token string,
) int {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("files", name)
	require.NoError(t, err)
	_, err = io.WriteString(part, content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	request := httptest.NewRequest(http.MethodPost, target, &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, request)
	return recorder.Code
}

func performRequest(
	t *testing.T,
	app *gin.Engine,
	method string,
	target string,
	body interface{},
	token string,
) (int, testResponse) {
	t.Helper()

	var requestBody bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		require.NoError(t, err)
		requestBody = *bytes.NewReader(data)
	}

	request := httptest.NewRequest(method, target, &requestBody)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, request)

	var response testResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	require.NotEmpty(t, response.TraceID)
	return recorder.Code, response
}
