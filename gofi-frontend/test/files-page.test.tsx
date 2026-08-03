import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Files from '@/pages/file/Files'
import { useDirectory } from '@/features/files/useDirectory'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/features/files/useDirectory', () => ({ useDirectory: vi.fn() }))
vi.mock('@/features/permissions/useAccessCapabilities', () => ({
    useAccessCapabilities: () => ({
        capabilities: { list: true, preview: true, download: true, upload: true, remove: true },
    }),
}))
vi.mock('@/components/layouts/MainLayout/Index', () => ({
    default: ({ children }: PropsWithChildren) => <>{children}</>,
}))
vi.mock('@/components/PageHeader', () => ({ default: () => null }))
vi.mock('@/components/UploadDialog', () => ({ UploadDialog: () => null }))

const roots: Root[] = []
const storedValues = new Map<string, string>()
const browserStorage: Storage = {
    get length() { return storedValues.size },
    clear: () => storedValues.clear(),
    getItem: (key) => storedValues.get(key) ?? null,
    key: (index) => Array.from(storedValues.keys())[index] ?? null,
    removeItem: (key) => { storedValues.delete(key) },
    setItem: (key, value) => { storedValues.set(key, value) },
}

beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    Object.defineProperty(window, 'localStorage', { configurable: true, value: browserStorage })
})

afterEach(async () => {
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
    browserStorage.clear()
    vi.clearAllMocks()
})

async function renderAt(path: string) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
        root.render(<MemoryRouter initialEntries={[path]}><Files /></MemoryRouter>)
    })
    return container
}

describe('Files page regressions', () => {
    it('uses the URL directory on the first render instead of requesting root first', async () => {
        vi.mocked(useDirectory).mockReturnValue({
            files: [], error: undefined, isLoading: false, isValidating: false, refresh: vi.fn(),
        })
        await renderAt('/file/docs/')
        expect(vi.mocked(useDirectory).mock.calls[0]?.[0]).toBe('/docs')
        expect(vi.mocked(useDirectory).mock.calls.some(([path]) => path === '/')).toBe(false)
    })

    it('opens the native file picker from the empty-folder action', async () => {
        vi.mocked(useDirectory).mockReturnValue({
            files: [], error: undefined, isLoading: false, isValidating: false, refresh: vi.fn(),
        })
        const container = await renderAt('/file/')
        const input = container.querySelector<HTMLInputElement>('input[type="file"]')
        const click = vi.spyOn(input as HTMLInputElement, 'click').mockImplementation(() => undefined)
        const uploadButton = Array.from(container.querySelectorAll('button'))
            .find((button) => button.textContent?.includes('pages.file-list.upload-files'))

        await act(async () => uploadButton?.click())
        expect(click).toHaveBeenCalledOnce()
    })
})
