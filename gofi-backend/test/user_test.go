package test

import (
	"testing"

	"gofi/tool"

	"github.com/stretchr/testify/require"
)

func TestJWTGeneration(t *testing.T) {
	token, err := tool.GenerateJWT(1, "testuser", 1, 3)
	require.NoError(t, err)
	require.NotEmpty(t, token)

	claims, err := tool.ParseJWTString(token)
	require.NoError(t, err)
	require.Equal(t, int64(1), claims.UserId)
	require.Equal(t, int64(3), claims.TokenVersion)
}

func TestPasswordHash(t *testing.T) {
	hash, err := tool.HashPassword("a-secure-password")
	require.NoError(t, err)
	require.NotContains(t, hash, "a-secure-password")

	valid, needsUpgrade := tool.VerifyPassword(hash, "a-secure-password")
	require.True(t, valid)
	require.False(t, needsUpgrade)

	valid, _ = tool.VerifyPassword(hash, "wrong-password")
	require.False(t, valid)
}
