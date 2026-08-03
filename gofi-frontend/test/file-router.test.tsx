import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import useSWR from 'swr'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import FileRouter from '@/pages/file/FileRouter'
import type { DirectoryData, FileData } from '@/features/files/types'

vi.mock('swr', () => ({ default: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/pages/file/Files', () => ({
    default: ({ directoryData }: { directoryData?: DirectoryData }) => (
        <div data-kind="directory">{directoryData?.path ?? 'fallback'}</div>
    ),
}))
vi.mock('@/pages/file/File', () => ({
    default: ({ fileData }: { fileData: FileData }) => <div data-kind="file">{fileData.file.name}</div>,
}))
vi.mock('@/components/LogoLoading', () => ({ default: () => <div data-loading /> }))

const roots: Root[] = []

beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(async () => {
    while (roots.length > 0) {
        await act(async () => roots.pop()?.unmount())
    }
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

async function renderAt(path: string) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
        root.render(<MemoryRouter initialEntries={[path]}><FileRouter /></MemoryRouter>)
    })
    return container
}

describe('FileRouter', () => {
    it('dispatches directories using the normalized URL path', async () => {
        vi.mocked(useSWR).mockReturnValue({
            data: { type: 'directory', data: { path: '/docs', files: [] } },
            error: undefined,
            isLoading: false,
        } as ReturnType<typeof useSWR>)

        const container = await renderAt('/file/docs/')
        expect(container.querySelector('[data-kind="directory"]')?.textContent).toBe('/docs')
        expect(vi.mocked(useSWR).mock.calls[0]?.[0]).toEqual(['file_detail', '/docs'])
    })

    it('dispatches files without issuing a second component-level request', async () => {
        const file: FileData = {
            file: {
                name: 'avatar.png',
                path: '/avatar.png',
                size: 6,
                extension: '.png',
                mime: 'image/png',
                lastModified: 1,
                content: '',
                fileType: 'image',
                iconType: 'image',
                isDirectory: false,
            },
        }
        vi.mocked(useSWR).mockReturnValue({
            data: { type: 'file', data: file },
            error: undefined,
            isLoading: false,
        } as ReturnType<typeof useSWR>)

        const container = await renderAt('/file/avatar.png')
        expect(container.querySelector('[data-kind="file"]')?.textContent).toBe('avatar.png')
        expect(useSWR).toHaveBeenCalledTimes(1)
    })

    it('renders explicit loading and error states', async () => {
        vi.mocked(useSWR).mockReturnValue({ isLoading: true } as ReturnType<typeof useSWR>)
        const loading = await renderAt('/file/docs')
        expect(loading.querySelector('[data-loading]')).not.toBeNull()

        await act(async () => roots.pop()?.unmount())
        loading.remove()
        vi.mocked(useSWR).mockReturnValue({
            isLoading: false,
            error: new Error('network failed'),
        } as ReturnType<typeof useSWR>)
        const failed = await renderAt('/file/docs')
        expect(failed.textContent).toContain('network failed')
        expect(failed.textContent).toContain('common.retry')
    })
})
