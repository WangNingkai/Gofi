import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ViewerToolbar from '@/components/viewer/ViewerToolbar'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
    TooltipContent: ({ children }: PropsWithChildren) => <>{children}</>,
    TooltipProvider: ({ children }: PropsWithChildren) => <>{children}</>,
    TooltipTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
}))
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
        <button {...props}>{children}</button>
    ),
}))
vi.mock('@/components/ui/breadcrumb', () => ({
    Breadcrumb: ({ children }: PropsWithChildren) => <nav>{children}</nav>,
    BreadcrumbList: ({ children }: PropsWithChildren) => <div>{children}</div>,
    BreadcrumbItem: ({ children }: PropsWithChildren) => <span>{children}</span>,
    BreadcrumbLink: ({ children, ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...props}>{children}</button>,
    BreadcrumbPage: ({ children }: PropsWithChildren) => <span>{children}</span>,
    BreadcrumbSeparator: () => <span>/</span>,
    BreadcrumbEllipsis: () => <span>…</span>,
}))

const roots: Root[] = []

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

afterEach(async () => {
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
})

describe('ViewerToolbar', () => {
    it('exposes a direct root-directory action from every preview', async () => {
        const onRoot = vi.fn()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)
        await act(async () => root.render(<ViewerToolbar currentPath="/docs/photo.png" onRoot={onRoot} />))

        const rootButton = container.querySelector<HTMLButtonElement>('[aria-label="component.viewer.toolbar.root"]')
        expect(rootButton).not.toBeNull()
        rootButton?.click()
        expect(onRoot).toHaveBeenCalledTimes(1)
    })
})
