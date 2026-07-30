package middleware

import (
	"gofi/i18n"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

// SecurityConfig 安全配置
type SecurityConfig struct {
	// IP 白名单（优先级高于黑名单）
	Whitelist []string
	// IP 黑名单
	Blacklist []string
	// 是否启用 CSRF 保护
	EnableCSRF bool
	// 是否启用 XSS 防护
	EnableXSS bool
}

var (
	securityConfig = &SecurityConfig{
		Whitelist:  []string{},
		Blacklist:  []string{},
		EnableCSRF: true,
		EnableXSS:  true,
	}
	configMutex sync.RWMutex
)

// SetSecurityConfig 设置安全配置
func SetSecurityConfig(config *SecurityConfig) {
	configMutex.Lock()
	defer configMutex.Unlock()
	if config == nil {
		return
	}
	securityConfig = cloneSecurityConfig(config)
}

// GetSecurityConfig 获取安全配置
func GetSecurityConfig() *SecurityConfig {
	configMutex.RLock()
	defer configMutex.RUnlock()
	return cloneSecurityConfig(securityConfig)
}

func cloneSecurityConfig(config *SecurityConfig) *SecurityConfig {
	return &SecurityConfig{
		Whitelist:  append([]string(nil), config.Whitelist...),
		Blacklist:  append([]string(nil), config.Blacklist...),
		EnableCSRF: config.EnableCSRF,
		EnableXSS:  config.EnableXSS,
	}
}

// IPFilter IP 过滤中间件
func IPFilter() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		config := GetSecurityConfig()

		// 检查白名单
		if len(config.Whitelist) > 0 {
			if !isIPInList(clientIP, config.Whitelist) {
				logger := GetLogger(c)
				logger.WithField("client_ip", clientIP).Warn("IP 不在白名单中")
				abortWithError(c, http.StatusForbidden, 10004, i18n.T(c, "error.access_denied"))
				return
			}
		}

		// 检查黑名单
		if isIPInList(clientIP, config.Blacklist) {
			logger := GetLogger(c)
			logger.WithField("client_ip", clientIP).Warn("IP 在黑名单中")
			abortWithError(c, http.StatusForbidden, 10004, i18n.T(c, "error.access_denied"))
			return
		}

		c.Next()
	}
}

// CSRFProtection CSRF 保护中间件
func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		config := GetSecurityConfig()
		if !config.EnableCSRF {
			c.Next()
			return
		}

		// 只对非 GET 请求进行 CSRF 检查
		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		origin := c.GetHeader("Origin")
		referer := c.GetHeader("Referer")

		if origin != "" {
			if !originAllowed(c.Request, origin) {
				logger := GetLogger(c)
				logger.Warn("CSRF 检查拒绝了非同源请求")
				abortWithError(c, http.StatusForbidden, 10004, i18n.T(c, "error.invalid_origin"))
				return
			}
		} else if referer != "" {
			parsed, err := url.Parse(referer)
			if err != nil || !originAllowed(c.Request, parsed.Scheme+"://"+parsed.Host) {
				logger := GetLogger(c)
				logger.Warn("CSRF 检查拒绝了非同源 Referer")
				abortWithError(c, http.StatusForbidden, 10004, i18n.T(c, "error.invalid_origin"))
				return
			}
		}

		c.Next()
	}
}

// XSSProtection XSS 防护中间件
func XSSProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		config := GetSecurityConfig()
		if !config.EnableXSS {
			c.Next()
			return
		}

		// 只对非 /api/download 路径设置 X-Frame-Options
		if !strings.HasPrefix(c.Request.URL.Path, "/api/download") {
			c.Header("X-Frame-Options", "DENY")
		}
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header(
			"Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "+
				"frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
		)

		c.Next()
	}
}

// isIPInList 检查 IP 是否在列表中
func isIPInList(clientIP string, ipList []string) bool {
	for _, ip := range ipList {
		if ip == clientIP {
			return true
		}
		// 支持 CIDR 格式
		if strings.Contains(ip, "/") {
			if isIPInCIDR(clientIP, ip) {
				return true
			}
		}
	}
	return false
}

// isIPInCIDR 检查 IP 是否在 CIDR 范围内
func isIPInCIDR(clientIP, cidr string) bool {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return false
	}

	ip := net.ParseIP(clientIP)
	if ip == nil {
		return false
	}

	return ipNet.Contains(ip)
}
