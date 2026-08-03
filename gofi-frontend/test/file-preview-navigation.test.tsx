import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import File from '@/pages/file/File'
import type { FileData, FileInfo } from '@/features/files/types'
import { useDirectory } from '@/features/files/useDirectory'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/features/files/useDirectory', () => ({ useDirectory: vi.fn() }))
vi.mock('@/features/permissions/useAccessCapabilities', () => ({
    useAccessCapabilities: () => ({ capabilities: { preview: true, download: true } }),
}))
vi.mock('@/components/layouts/MainLayout/Index', () => ({
    default: ({ children }: PropsWithChildren) => <>{children}</>,
}))
vi.mock('@/components/viewer/ImageViewer', () => ({
    default: ({ imageList, onReturn }: { imageList: string[]; onReturn?: () => void }) => (
        <button data-image-list={imageList.join(',')} data-preview-return onClick={onReturn}>return</button>
    ),
}))

const image: FileInfo = {
    name: 'avatar.png',
    path: '/gallery/avatar.png',
    size: 128,
    extension: '.png',
    mime: 'image/png',
    lastModified: 1,
    content: '',
    fileType: 'image',
    iconType: 'image',
    isDirectory: false,
}
const fileData: FileData = { file: image }
const roots: Root[] = []

function LocationProbe() {
    return <output data-location>{useLocation().pathname}</output>
}

beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(async () => {
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

describe('file preview directory navigation', () => {
    it('uses the shared directory cache contract and returns to the populated parent route', async () => {
        vi.mocked(useDirectory).mockReturnValue({
            files: [image],
            error: undefined,
            isLoading: false,
            isValidating: false,
            refresh: vi.fn(),
        })
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/file/gallery/avatar.png']}>
                    <File fileData={fileData} />
                    <LocationProbe />
                </MemoryRouter>,
            )
        })

        expect(vi.mocked(useDirectory).mock.calls.some(([path]) => path === '/gallery')).toBe(true)
        expect(container.querySelector('[data-preview-return]')?.getAttribute('data-image-list'))
            .toContain('/api/download?path=%2Fgallery%2Favatar.png&raw=true')

        await act(async () => {
            container.querySelector<HTMLButtonElement>('[data-preview-return]')?.click()
        })
        expect(container.querySelector('[data-location]')?.textContent).toBe('/file/gallery')
    })
})
