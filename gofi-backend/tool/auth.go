package tool

import (
	"crypto/md5"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"gofi/env"
	"time"

	"strings"

	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

// getJWTSecret 获取JWT密钥
func getJWTSecret() (string, error) {
	if err := env.EnsureJWTSecret(); err != nil {
		return "", err
	}
	config := env.GetConfiguration()
	return config.JWTSecret, nil
}

// getJWTExpireHours 获取JWT过期时间
func getJWTExpireHours() int {
	config := env.GetConfiguration()
	return config.JWTExpireHours
}

func legacyMD5(text string) string {
	ctx := md5.New()
	ctx.Write([]byte(text))
	return hex.EncodeToString(ctx.Sum(nil))
}

func HashPassword(password string) (string, error) {
	if len(password) < 10 {
		return "", fmt.Errorf("password must contain at least 10 characters")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// VerifyPassword 支持读取旧 MD5 值；needsUpgrade 为 true 时调用方应立即写回 bcrypt。
func VerifyPassword(encoded, password string) (valid bool, needsUpgrade bool) {
	if strings.HasPrefix(encoded, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(encoded), []byte(password)) == nil, false
	}
	if len(encoded) == md5.Size*2 {
		expected := legacyMD5(password)
		return subtle.ConstantTimeCompare([]byte(encoded), []byte(expected)) == 1, true
	}
	return false, false
}

// JWTClaims 自定义JWT声明
type JWTClaims struct {
	UserId       int64  `json:"user_id"`
	Username     string `json:"username"`
	RoleType     int    `json:"role_type"`
	TokenVersion int64  `json:"token_version"`
	jwt.RegisteredClaims
}

// GenerateJWT 生成JWT Token
func GenerateJWT(userId int64, username string, roleType int, versions ...int64) (string, error) {
	secret, err := getJWTSecret()
	if err != nil {
		return "", err
	}
	var tokenVersion int64
	if len(versions) > 0 {
		tokenVersion = versions[0]
	}
	claims := JWTClaims{
		UserId:       userId,
		Username:     username,
		RoleType:     roleType,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  []string{"Gofi"},
			Issuer:    "Gofi",
			Subject:   "Authentication",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(getJWTExpireHours()) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseJWTString(tokenString string) (*JWTClaims, error) {
	secret, err := getJWTSecret()
	if err != nil {
		return nil, err
	}
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		Errorf("JWT解析失败: %v", err)
		return nil, fmt.Errorf("invalid token: %v", err)
	}

	// 验证Token
	if !token.Valid {
		return nil, fmt.Errorf("token is invalid")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}
