import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import AppErrorBoundary from '@/components/AppErrorBoundary'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, asChild, ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>) => (
        asChild ? <>{children}</> : <button {...props}>{children}</button>
    ),
}))

const roots: Root[] = []
const Broken = () => { throw new Error('render exploded') }

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

afterEach(async () => {
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AppErrorBoundary', () => {
    it('keeps a render failure recoverable and logs diagnostic context', async () => {
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        await act(async () => root.render(<AppErrorBoundary><Broken /></AppErrorBoundary>))

        expect(container.textContent).toContain('component.exception.500.title')
        expect(container.textContent).toContain('render exploded')
        expect(container.querySelector('a[href="/file/"]')).not.toBeNull()
        expect(errorLog.mock.calls.some((call) => call[0] === '[gofi:frontend-error]')).toBe(true)
    })
})
