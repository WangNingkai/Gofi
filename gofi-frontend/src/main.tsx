import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import AppProviders from './app/AppProviders'
import './i18n'
import './index.css'
import 'github-markdown-css/github-markdown-light.css'
import darkMarkdownCss from 'github-markdown-css/github-markdown-dark.css?inline'

const container = document.getElementById('root')
if (container) {
    createRoot(container).render(
        <AppProviders>
            <App />
        </AppProviders>,
    )
}

function updateMarkdownTheme() {
    const id = 'github-markdown-dark-theme'
    const existing = document.getElementById(id)
    if (!document.documentElement.classList.contains('dark')) {
        existing?.remove()
        return
    }
    if (!existing) {
        const style = document.createElement('style')
        style.id = id
        style.textContent = darkMarkdownCss
        document.head.appendChild(style)
    }
}

new MutationObserver(updateMarkdownTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
})
updateMarkdownTheme()
