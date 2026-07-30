package env

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/joho/godotenv"
)

// Configuration 应用配置
type Configuration struct {
	// JWT配置
	JWTSecret      string
	JWTExpireHours int

	// 安全配置
	EnableRateLimit      bool
	MaxRequestsPerMinute int
	AllowedOrigins       []string
	TrustedProxies       []string

	// 日志配置
	LogLevel    string
	EnableDebug bool
}

var (
	config     *Configuration
	configOnce sync.Once
	secretOnce sync.Once
	secretErr  error
)

// GetConfiguration 获取应用配置（支持 .env 文件自动加载，单例）
func GetConfiguration() *Configuration {
	configOnce.Do(func() {
		_ = godotenv.Load() // 自动加载 .env 文件，环境变量优先
		config = &Configuration{
			// JWT配置
			JWTSecret:      strings.TrimSpace(os.Getenv("GOFI_JWT_SECRET")),
			JWTExpireHours: getEnvIntOrDefault("GOFI_JWT_EXPIRE_HOURS", 24*30), // 默认30天

			// 安全配置
			EnableRateLimit:      getEnvBoolOrDefault("GOFI_ENABLE_RATE_LIMIT", true),
			MaxRequestsPerMinute: getEnvIntOrDefault("GOFI_MAX_REQUESTS_PER_MINUTE", 100),
			AllowedOrigins:       getEnvList("GOFI_ALLOWED_ORIGINS"),
			TrustedProxies:       getEnvList("GOFI_TRUSTED_PROXIES"),

			// 日志配置
			LogLevel:    getEnvOrDefault("GOFI_LOG_LEVEL", "info"),
			EnableDebug: getEnvBoolOrDefault("GOFI_ENABLE_DEBUG", false),
		}
		if len(config.AllowedOrigins) == 0 && IsDevelop() {
			config.AllowedOrigins = []string{"http://localhost:3000", "http://localhost:5173"}
		}
		if config.MaxRequestsPerMinute < 1 {
			config.MaxRequestsPerMinute = 100
		}
	})
	return config
}

// EnsureJWTSecret 在应用显式启动时加载或创建持久化签名密钥。
func EnsureJWTSecret() error {
	secretOnce.Do(func() {
		current := GetConfiguration()
		if current.JWTSecret != "" {
			if len(current.JWTSecret) < 32 {
				secretErr = fmt.Errorf("GOFI_JWT_SECRET must contain at least 32 characters")
			}
			return
		}

		generated, err := generateSecret()
		if err != nil {
			secretErr = err
			return
		}
		if IsTest() {
			current.JWTSecret = generated
			return
		}

		path := strings.TrimSpace(os.Getenv("GOFI_JWT_SECRET_FILE"))
		if path == "" {
			path = filepath.Join(".", ".gofi-jwt-secret")
		}
		if secret, err := readSecretFile(path); err == nil {
			current.JWTSecret = secret
			return
		} else if !os.IsNotExist(err) {
			secretErr = err
			return
		}

		file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
		if os.IsExist(err) {
			secret, readErr := readSecretFile(path)
			if readErr != nil {
				secretErr = readErr
			} else {
				current.JWTSecret = secret
			}
			return
		}
		if err != nil {
			secretErr = fmt.Errorf("create JWT secret file: %w", err)
			return
		}
		if _, err := file.WriteString(generated + "\n"); err != nil {
			_ = file.Close()
			_ = os.Remove(path)
			secretErr = fmt.Errorf("write JWT secret file: %w", err)
			return
		}
		if err := file.Sync(); err != nil {
			_ = file.Close()
			_ = os.Remove(path)
			secretErr = fmt.Errorf("sync JWT secret file: %w", err)
			return
		}
		if err := file.Close(); err != nil {
			secretErr = fmt.Errorf("close JWT secret file: %w", err)
			return
		}
		current.JWTSecret = generated
	})
	return secretErr
}

func readSecretFile(path string) (string, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	secret := strings.TrimSpace(string(contents))
	if len(secret) < 32 {
		return "", fmt.Errorf("JWT secret file must contain at least 32 characters")
	}
	if err := os.Chmod(path, 0o600); err != nil {
		return "", fmt.Errorf("secure JWT secret file: %w", err)
	}
	return secret, nil
}

func generateSecret() (string, error) {
	bytes := make([]byte, 48)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate JWT secret: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// getEnvOrDefault 获取环境变量，如果不存在则返回默认值
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvIntOrDefault 获取环境变量并转换为整数，如果不存在则返回默认值
func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := parseInt(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvBoolOrDefault 获取环境变量并转换为布尔值，如果不存在则返回默认值
func getEnvBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return strings.ToLower(value) == "true" || value == "1"
	}
	return defaultValue
}

func getEnvList(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	values := make([]string, 0)
	for _, value := range strings.Split(raw, ",") {
		if value = strings.TrimSpace(value); value != "" {
			values = append(values, value)
		}
	}
	return values
}

// parseInt 简单的字符串转整数函数
func parseInt(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}
