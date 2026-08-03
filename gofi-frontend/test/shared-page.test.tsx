import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Shared from '@/pages/Shared'
import { fetchSharedFile } from '@/features/shares/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/features/shares/api', () => ({
    fetchSharedFile: vi.fn(),
    sharedDownloadUrl: vi.fn(() => '/download'),
}))
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, asChild, ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>) => (
        asChild ? <>{children}</> : <button {...props}>{children}</button>
    ),
}))

const roots: Root[] = []

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

afterEach(async () => {
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

describe('Shared page', () => {
    it('renders an explicit empty state and can revalidate without reloading the page', async () => {
        vi.mocked(fetchSharedFile).mockResolvedValue({
            type: 'directory',
            data: { path: '/', files: [] },
        })
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        await act(async () => {
            root.render(<MemoryRouter initialEntries={['/shared/token']}><Routes><Route path="/shared/:token" element={<Shared />} /></Routes></MemoryRouter>)
            await Promise.resolve()
        })

        expect(container.textContent).toContain('pages.file-list.empty-folder.title')
        const refresh = container.querySelector<HTMLButtonElement>('[aria-label="common.action.refresh"]')
        await act(async () => {
            refresh?.click()
            await Promise.resolve()
        })
        expect(fetchSharedFile).toHaveBeenCalledTimes(2)
        expect(window.location.pathname).not.toBe('/download')
    })
})
