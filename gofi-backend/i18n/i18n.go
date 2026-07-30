package i18n

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

//go:embed en.json zh_Hans.json
var i18nFS embed.FS

type ctxKey struct{}

var (
	translations = map[string]map[string]string{} // lang -> key -> value
	defaultLang  = "zh_Hans"
	mu           sync.RWMutex
)

// 加载所有语言包
func LoadTranslations() error {
	langs := []string{"zh_Hans", "en"}
	loaded := make(map[string]map[string]string, len(langs))
	for _, lang := range langs {
		filename := lang + ".json"
		data, err := i18nFS.ReadFile(filename)
		if err != nil {
			return fmt.Errorf("读取翻译文件 %s: %w", filename, err)
		}
		m := map[string]string{}
		if err := json.Unmarshal(data, &m); err != nil {
			return fmt.Errorf("解析翻译文件 %s: %w", filename, err)
		}
		loaded[lang] = m
	}
	mu.Lock()
	translations = loaded
	mu.Unlock()
	return nil
}

// 设置当前请求的语言
func WithLang(ctx context.Context, lang string) context.Context {
	return context.WithValue(ctx, ctxKey{}, lang)
}

// 获取当前请求的语言
func getLang(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKey{}).(string); ok && v != "" {
		return strings.ReplaceAll(v, "-", "_")
	}
	return defaultLang
}

// 翻译
func T(ctx context.Context, key string, args ...interface{}) string {
	lang := getLang(ctx)
	mu.RLock()
	defer mu.RUnlock()
	if m, ok := translations[lang]; ok {
		if val, ok := m[key]; ok {
			return fmt.Sprintf(val, args...)
		}
	}
	// fallback
	if m, ok := translations[defaultLang]; ok {
		if val, ok := m[key]; ok {
			return fmt.Sprintf(val, args...)
		}
	}
	return key
}
