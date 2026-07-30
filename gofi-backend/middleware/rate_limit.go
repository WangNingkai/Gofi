package middleware

import (
	"gofi/i18n"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// PerIPRateLimiter returns a middleware that limits the request rate on a per-IP basis.
func PerIPRateLimiter(r rate.Limit, b int) gin.HandlerFunc {
	type visitor struct {
		limiter  *rate.Limiter
		lastSeen time.Time
	}
	var mutex sync.Mutex
	limiters := make(map[string]*visitor)
	requests := 0
	return func(c *gin.Context) {
		now := time.Now()
		clientIP := c.ClientIP()
		mutex.Lock()
		current, exists := limiters[clientIP]
		if !exists {
			current = &visitor{limiter: rate.NewLimiter(r, b)}
			limiters[clientIP] = current
		}
		current.lastSeen = now
		requests++
		if requests%1000 == 0 {
			for ip, item := range limiters {
				if now.Sub(item.lastSeen) > time.Hour {
					delete(limiters, ip)
				}
			}
		}
		allowed := current.limiter.Allow()
		mutex.Unlock()
		if !allowed {
			abortWithError(c, http.StatusTooManyRequests, 40001, i18n.T(c, "error.too_many_requests"))
			return
		}
		c.Next()
	}
}
