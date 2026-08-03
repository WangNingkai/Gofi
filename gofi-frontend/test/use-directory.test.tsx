import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirectoryData } from '@/features/files/types'
import { useDirectory } from '@/features/files/useDirectory'
import { fetchFile } from '@/features/files/api'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/features/files/api', () => ({
    fetchFile: vi.fn(),
}))

const initial: DirectoryData = {
    path: '/',
    files: [],
}

const refreshed: DirectoryData = {
    path: '/',
    files: [{
        name: 'avatar.png',
        isDirectory: false,
        size: 128,
        extension: '.png',
        mime: 'image/png',
        path: '/avatar.png',
        lastModified: 1,
        content: '',
        fileType: 'image',
        iconType: 'image',
    }],
}

describe('useDirectory', () => {
    afterEach(() => {
        vi.clearAllMocks()
        document.body.innerHTML = ''
    })

    it('refreshes server data even when the first directory listing was provided by the router', async () => {
        vi.mocked(fetchFile).mockResolvedValue({ type: 'directory', data: refreshed })
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        let refresh: ReturnType<typeof useDirectory>['refresh'] | undefined

        function Probe() {
            const directory = useDirectory('/', initial)
            refresh = directory.refresh
            return <span>{directory.files?.map((file) => file.name).join(',') || 'empty'}</span>
        }

        await act(async () => {
            root.render(
                <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                    <Probe />
                </SWRConfig>,
            )
        })

        expect(container.textContent).toBe('empty')
        expect(fetchFile).not.toHaveBeenCalled()

        await act(async () => {
            await refresh?.()
        })

        expect(fetchFile).toHaveBeenCalledWith('/')
        expect(container.textContent).toBe('avatar.png')

        await act(async () => root.unmount())
    })
})
