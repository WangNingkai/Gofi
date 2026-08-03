import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ImageViewer from '@/components/viewer/ImageViewer'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/viewer/ImageViewerToolbar', () => ({ default: () => <div data-toolbar /> }))
vi.mock('@/utils/toast.util', () => ({ default: { i: vi.fn() } }))
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...props}>{children}</button>,
}))

const roots: Root[] = []

beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.stubGlobal('ResizeObserver', class {
        observe() {}
        disconnect() {}
    })
})

afterEach(async () => {
    vi.useRealTimers()
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
})

async function renderImage() {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(<ImageViewer url="/preview/avatar.png" imageList={['/preview/avatar.png']} />))
    return container
}

describe('ImageViewer loading transitions', () => {
    it('never reveals a loading overlay when the image resolves quickly', async () => {
        vi.useFakeTimers()
        const container = await renderImage()
        await act(async () => vi.advanceTimersByTime(100))
        await act(async () => container.querySelector('img')?.dispatchEvent(new Event('load', { bubbles: true })))
        await act(async () => vi.advanceTimersByTime(500))
        expect(container.querySelector('[role="status"]')).toBeNull()
    })

    it('keeps slow-loading feedback stable before revealing the image', async () => {
        vi.useFakeTimers()
        const container = await renderImage()
        await act(async () => vi.advanceTimersByTime(220))
        expect(container.querySelector('[role="status"]')).not.toBeNull()

        await act(async () => container.querySelector('img')?.dispatchEvent(new Event('load', { bubbles: true })))
        await act(async () => vi.advanceTimersByTime(279))
        expect(container.querySelector('[role="status"]')).not.toBeNull()
        await act(async () => vi.advanceTimersByTime(1))
        expect(container.querySelector('[role="status"]')).toBeNull()
    })
})
