import React, { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { UploadDialog } from '@/components/UploadDialog'
import { useUploadTask } from '@/features/upload/useUploadTask'
import Toast from '@/utils/toast.util'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/features/upload/useUploadTask', () => ({
    useUploadTask: vi.fn(),
}))

vi.mock('@/utils/toast.util', () => ({
    default: { s: vi.fn(), e: vi.fn() },
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: PropsWithChildren) => <>{children}</>,
    DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))

const startMock = vi.fn<() => Promise<void>>()
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

describe('UploadDialog', () => {
    it('starts one upload per dialog opening even when callback props change', async () => {
        startMock.mockResolvedValue(undefined)
        vi.mocked(useUploadTask).mockReturnValue({
            tasks: [],
            error: '',
            isUploading: false,
            start: startMock,
        })

        const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        const render = async (open: boolean, onSuccess = vi.fn()) => {
            await act(async () => {
                root.render(
                    <UploadDialog
                        open={open}
                        onOpenChange={vi.fn()}
                        files={[file]}
                        onUpload={vi.fn()}
                        onSuccess={onSuccess}
                    />,
                )
                await Promise.resolve()
            })
        }

        await render(true)
        await render(true, vi.fn())
        expect(startMock).toHaveBeenCalledTimes(1)

        await render(false)
        await render(true)
        expect(startMock).toHaveBeenCalledTimes(2)
        expect(Toast.s).toHaveBeenCalledTimes(2)
    })

    it('rejects automatic uploads when permission is missing', async () => {
        vi.mocked(useUploadTask).mockReturnValue({
            tasks: [],
            error: '',
            isUploading: false,
            start: startMock,
        })
        const onError = vi.fn()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        await act(async () => {
            root.render(
                <UploadDialog
                    open
                    onOpenChange={vi.fn()}
                    files={[new File(['x'], 'x.txt')]}
                    onUpload={vi.fn()}
                    onError={onError}
                    canUpload={false}
                />,
            )
            await Promise.resolve()
        })

        expect(startMock).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith('pages.exception.403.description')
        expect(Toast.e).toHaveBeenCalledWith('pages.exception.403.description')
    })
})
