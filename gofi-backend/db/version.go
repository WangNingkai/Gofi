package db

import (
	"strings"

	"gofi/env"
)

// version is replaced at compile time with -ldflags="-X gofi/db.version=X.Y.Z".
var version = "unknown"

func init() {
	if env.IsDevelop() {
		version = "dev"
	}
}

func Version() string {
	return strings.TrimPrefix(version, "v")
}
