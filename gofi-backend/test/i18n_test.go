package test

import (
	"context"
	"testing"

	"gofi/i18n"

	"github.com/stretchr/testify/assert"
)

func TestTranslation(t *testing.T) {
	assert.NoError(t, i18n.LoadTranslations())

	t.Run("中文翻译", func(t *testing.T) {
		ctx := i18n.WithLang(context.Background(), "zh_Hans")
		assert.Equal(t, "请先登录", i18n.T(ctx, "user.login_required"))
		assert.Equal(t, "上传完成", i18n.T(ctx, "success.upload"))
	})

	t.Run("英文翻译", func(t *testing.T) {
		ctx := i18n.WithLang(context.Background(), "en")
		assert.Equal(t, "Please login first", i18n.T(ctx, "user.login_required"))
		assert.Equal(t, "Upload completed", i18n.T(ctx, "success.upload"))
	})

	t.Run("默认语言", func(t *testing.T) {
		assert.Equal(t, "请先登录", i18n.T(context.Background(), "user.login_required"))
	})

	t.Run("新增错误键具有英文翻译", func(t *testing.T) {
		ctx := i18n.WithLang(context.Background(), "en")
		assert.Equal(t, "The system is already initialized", i18n.T(ctx, "error.already_initialized"))
		assert.Equal(t, "Insufficient permissions", i18n.T(ctx, "auth.insufficient_permissions"))
	})

	t.Run("未知翻译键原样返回", func(t *testing.T) {
		ctx := i18n.WithLang(context.Background(), "zh_Hans")
		assert.Equal(t, "unknown.key", i18n.T(ctx, "unknown.key"))
	})
}

func TestTranslationWithParameters(t *testing.T) {
	assert.NoError(t, i18n.LoadTranslations())

	t.Run("带参数翻译", func(t *testing.T) {
		ctx := i18n.WithLang(context.Background(), "zh_Hans")
		assert.Equal(t, "文件不存在: test.txt", i18n.T(ctx, "file.not_exist", "test.txt"))
	})
}

func TestConcurrentTranslation(t *testing.T) {
	assert.NoError(t, i18n.LoadTranslations())

	t.Run("并发翻译", func(t *testing.T) {
		ctx := i18n.WithLang(context.Background(), "zh_Hans")
		results := make(chan string, 10)
		for i := 0; i < 10; i++ {
			go func() {
				results <- i18n.T(ctx, "user.login_required")
			}()
		}
		for i := 0; i < 10; i++ {
			assert.Equal(t, "请先登录", <-results)
		}
	})
}
