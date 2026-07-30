//go:build !preview && !production
// +build !preview,!production

package env

import embed "embed"

// current 当前模式
const current = Development

var EmbedStaticAssets embed.FS
