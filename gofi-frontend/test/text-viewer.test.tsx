import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import TextViewer, { INITIAL_TEXT_PREVIEW_LENGTH } from '@/components/viewer/TextViewer'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/viewer/TextViewerToolbar', () => ({ default: () => <div data-toolbar /> }))
vi.mock('@/components/ShikiHighlighter', () => ({
    default: ({ code }: { code: string }) => <pre data-highlight-length={code.length}>{code}</pre>,
}))
vi.mock('@/components/viewer/MarkdownPreview', () => ({
    default: ({ content }: { content: string }) => <div>{content}</div>,
}))
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
        <button {...props}>{children}</button>
    ),
}))

const roots: Root[] = []

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

afterEach(async () => {
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
})

async function renderViewer(content: string, language = 'typescript') {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(<TextViewer content={content} language={language} />))
    return container
}

describe('TextViewer performance boundaries', () => {
    it('renders empty files as empty instead of an endless loading state', async () => {
        const container = await renderViewer('', 'plaintext')
        expect(container.textContent).toContain('common.status.empty')
        expect(container.querySelector('[role="status"]')).toBeNull()
    })

    it('highlights only the initial slice and falls back to plain text for a huge full file', async () => {
        const content = `const value = 1;\n${'x'.repeat(80_000)}`
        const container = await renderViewer(content)
        expect(container.querySelector('[data-highlight-length]')?.getAttribute('data-highlight-length'))
            .toBe(String(INITIAL_TEXT_PREVIEW_LENGTH))

        const showMore = Array.from(container.querySelectorAll('button'))
            .find((button) => button.textContent === 'component.viewer.show-more')
        await act(async () => showMore?.click())

        expect(container.querySelector('[data-highlight-length]')).toBeNull()
        expect(container.querySelector('pre')?.textContent).toBe(content)
    })
})
