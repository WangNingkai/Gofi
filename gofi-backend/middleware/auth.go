package middleware

import (
	"net/http"
	"strings"

	"gofi/application"
	"gofi/db"
	"gofi/i18n"

	"github.com/gin-gonic/gin"
)

const (
	currentUserKey    = "currentUser"
	SessionCookieName = "gofi_session"
)

var ErrNoCurrentUser = application.ErrUnauthenticated

func OptionalAuth(authentication *application.AuthenticationService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		token := requestToken(ctx)
		if token == "" {
			ctx.Next()
			return
		}

		user, err := authenticate(authentication, token)
		if err != nil {
			abortAuth(ctx, http.StatusUnauthorized, 10001, i18n.T(ctx, "auth.not_authorized"))
			return
		}
		ctx.Set(currentUserKey, user)
		ctx.Next()
	}
}

func RequireAuth(authentication *application.AuthenticationService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, err := authenticate(authentication, requestToken(ctx))
		if err != nil {
			abortAuth(ctx, http.StatusUnauthorized, 10001, i18n.T(ctx, "auth.not_authorized"))
			return
		}
		ctx.Set(currentUserKey, user)
		ctx.Next()
	}
}

func RequireAdmin(authentication *application.AuthenticationService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, err := authenticate(authentication, requestToken(ctx))
		if err != nil {
			abortAuth(ctx, http.StatusUnauthorized, 10001, i18n.T(ctx, "auth.not_authorized"))
			return
		}
		if user.RoleType != db.RoleTypeAdmin {
			abortAuth(ctx, http.StatusForbidden, 10004, i18n.T(ctx, "auth.insufficient_permissions"))
			return
		}
		ctx.Set(currentUserKey, user)
		ctx.Next()
	}
}

func requestToken(ctx *gin.Context) string {
	token := strings.TrimSpace(ctx.GetHeader("Authorization"))
	if token == "" {
		if cookie, err := ctx.Cookie(SessionCookieName); err == nil {
			token = cookie
		}
	}
	return token
}

func authenticate(authentication *application.AuthenticationService, token string) (*db.User, error) {
	if token == "" {
		return nil, application.ErrUnauthenticated
	}
	return authentication.Authenticate(token)
}

func GetCurrentUser(ctx *gin.Context) *db.User {
	value, exists := ctx.Get(currentUserKey)
	if !exists {
		return nil
	}
	user, ok := value.(*db.User)
	if !ok {
		return nil
	}
	return user
}

func abortAuth(ctx *gin.Context, status, code int, message string) {
	abortWithError(ctx, status, code, message)
}
