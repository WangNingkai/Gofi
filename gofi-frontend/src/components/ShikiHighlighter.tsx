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

const languageLoaders = {
    bash: () => import('@shikijs/langs/bash').then((module) => module.default),
    css: () => import('@shikijs/langs/css').then((module) => module.default),
    go: () => import('@shikijs/langs/go').then((module) => module.default),
    html: () => import('@shikijs/langs/html').then((module) => module.default),
    java: () => import('@shikijs/langs/java').then((module) => module.default),
    javascript: () => import('@shikijs/langs/javascript').then((module) => module.default),
    json: () => import('@shikijs/langs/json').then((module) => module.default),
    jsx: () => import('@shikijs/langs/jsx').then((module) => module.default),
    markdown: () => import('@shikijs/langs/markdown').then((module) => module.default),
    python: () => import('@shikijs/langs/python').then((module) => module.default),
    rust: () => import('@shikijs/langs/rust').then((module) => module.default),
    sql: () => import('@shikijs/langs/sql').then((module) => module.default),
    tsx: () => import('@shikijs/langs/tsx').then((module) => module.default),
    typescript: () => import('@shikijs/langs/typescript').then((module) => module.default),
    yaml: () => import('@shikijs/langs/yaml').then((module) => module.default),
}

type SupportedLanguage = keyof typeof languageLoaders
const languageLoading = new Map<SupportedLanguage, Promise<void>>()

const highlighter = createHighlighterCore({
    themes: [
        import('@shikijs/themes/github-light').then((module) => module.default),
        import('@shikijs/themes/github-dark').then((module) => module.default),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true, target: 'ES2018' }),
    warnings: false,
})

function normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase()
    const resolved = aliases[normalized] ?? normalized
    return supportedLanguages.has(resolved) ? resolved : 'plaintext'
}

async function ensureLanguage(language: string): Promise<void> {
    if (language === 'plaintext') return
    const supported = language as SupportedLanguage
    let pending = languageLoading.get(supported)
    if (!pending) {
        pending = highlighter.then(async (instance) => {
            await instance.loadLanguage(await languageLoaders[supported]())
        })
        languageLoading.set(supported, pending)
    }
    await pending
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
        const normalizedLanguage = normalizeLanguage(language)
        ensureLanguage(normalizedLanguage)
            .then(() => highlighter)
            .then((instance) => instance.codeToHtml(code, {
                lang: normalizedLanguage,
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
