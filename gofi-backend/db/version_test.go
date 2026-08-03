package db

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVersionNeverExposesReleaseTagPrefix(t *testing.T) {
	original := version
	t.Cleanup(func() { version = original })

	version = "v1.2.3"
	require.Equal(t, "1.2.3", Version())

	version = "test-abcdef123456"
	require.Equal(t, "test-abcdef123456", Version())
}
