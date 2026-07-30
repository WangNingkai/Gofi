import { useCallback, useState } from 'react'
import {
    createUploadTasks,
    settleUploadTasks,
    updateUploadProgress,
    type UploadTask,
} from './task'

type Upload = (
    files: File[],
    onProgress: (fileName: string, progress: number) => void,
) => Promise<void>

export function useUploadTask(files: File[], upload: Upload) {
    const [tasks, setTasks] = useState<UploadTask[]>(() => createUploadTasks(files))
    const [error, setError] = useState('')
    const [isUploading, setIsUploading] = useState(false)

    const start = useCallback(async () => {
        const initial = createUploadTasks(files)
        setTasks(initial)
        setError('')
        setIsUploading(true)
        try {
            await upload(files, (fileName, progress) => {
                setTasks((current) => updateUploadProgress(current, fileName, progress))
            })
            setTasks((current) => settleUploadTasks(current, 'completed'))
        } catch (reason) {
            setTasks((current) => settleUploadTasks(current, 'failed'))
            const message = reason instanceof Error ? reason.message : String(reason)
            setError(message)
            throw reason
        } finally {
            setIsUploading(false)
        }
    }, [files, upload])

    return { tasks, error, isUploading, start }
}
