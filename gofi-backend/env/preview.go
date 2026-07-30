//go:build preview
// +build preview

package env

import embed "embed"

const current = Preview

//go:embed dist/*
var EmbedStaticAssets embed.FS
