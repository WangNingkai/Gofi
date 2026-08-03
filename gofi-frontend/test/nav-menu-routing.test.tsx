import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NavMenu from '@/components/layouts/MainLayout/NavMenu'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mountedRoots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
    while (mountedRoots.length > 0) {
        await act(async () => mountedRoots.pop()?.unmount())
    }
    document.body.innerHTML = ''
})

describe('NavMenu routing', () => {
    it('marks files as selected after the home route redirects to /file/', async () => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        mountedRoots.push(root)

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/']}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/file/" replace />} />
                        <Route path="/file/*" element={<NavMenu />} />
                    </Routes>
                </MemoryRouter>,
            )
        })

        const fileLink = container.querySelector<HTMLAnchorElement>('a[href="/file"]')
        expect(fileLink?.getAttribute('aria-current')).toBe('page')
        expect(fileLink?.className).toContain('font-semibold')
    })
})
