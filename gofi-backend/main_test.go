package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"testing"

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
