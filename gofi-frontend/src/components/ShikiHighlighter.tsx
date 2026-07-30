import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers'
import React, { useEffect, useState } from 'react'
import type { CSSProperties, FC } from 'react'
import { cn } from '@/lib/utils'

interface ShikiHighlighterProps {
    code: string
    language?: string
    theme?: string
    className?: string
    style?: CSSProperties
    showLineNumbers?: boolean
}

const supportedLanguages = new Set([
    'bash', 'css', 'go', 'html', 'java', 'javascript', 'json', 'jsx',
    'markdown', 'python', 'rust', 'sql', 'tsx', 'typescript', 'yaml',
])

const aliases: Record<string, string> = {
    cjs: 'javascript',
    js: 'javascript',
    mjs: 'javascript',
    md: 'markdown',
    py: 'python',
    sh: 'bash',
    ts: 'typescript',
    yml: 'yaml',
}

const highlighter = createHighlighterCore({
    themes: [
        import('@shikijs/themes/github-light').then((module) => module.default),
        import('@shikijs/themes/github-dark').then((module) => module.default),
    ],
    langs: [
        import('@shikijs/langs/bash').then((module) => module.default),
        import('@shikijs/langs/css').then((module) => module.default),
        import('@shikijs/langs/go').then((module) => module.default),
        import('@shikijs/langs/html').then((module) => module.default),
        import('@shikijs/langs/java').then((module) => module.default),
        import('@shikijs/langs/javascript').then((module) => module.default),
        import('@shikijs/langs/json').then((module) => module.default),
        import('@shikijs/langs/jsx').then((module) => module.default),
        import('@shikijs/langs/markdown').then((module) => module.default),
        import('@shikijs/langs/python').then((module) => module.default),
        import('@shikijs/langs/rust').then((module) => module.default),
        import('@shikijs/langs/sql').then((module) => module.default),
        import('@shikijs/langs/tsx').then((module) => module.default),
        import('@shikijs/langs/typescript').then((module) => module.default),
        import('@shikijs/langs/yaml').then((module) => module.default),
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true, target: 'ES2018' }),
    warnings: false,
})

function normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase()
    const resolved = aliases[normalized] ?? normalized
    return supportedLanguages.has(resolved) ? resolved : 'plaintext'
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

const ShikiHighlighter: FC<ShikiHighlighterProps> = ({
    code,
    language = 'plaintext',
    theme = 'github-light',
    className,
    style,
    showLineNumbers = false,
}) => {
    const [html, setHtml] = useState('')

    useEffect(() => {
        let mounted = true
        highlighter
            .then((instance) => instance.codeToHtml(code, {
                lang: normalizeLanguage(language),
                theme: theme === 'github-dark' ? 'github-dark' : 'github-light',
                transformers: [transformerNotationDiff(), transformerNotationHighlight()],
            }))
            .then((result) => {
                if (mounted) setHtml(result)
            })
            .catch(() => {
                if (mounted) setHtml(`<pre>${escapeHtml(code)}</pre>`)
            })
        return () => {
            mounted = false
        }
    }, [code, language, theme])

    return (
        <div
            className={cn(className, showLineNumbers && 'line-numbers')}
            style={style}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )
}

export default ShikiHighlighter
