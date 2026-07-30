import type { AxiosProgressEvent } from 'axios'
import PathUtil from '@/utils/path.util'
import client, { BASE_URL } from '@/shared/api/client'
import type { FileResponse } from './types'

function encodedPath(path: string): string {
    return PathUtil.encodePath(PathUtil.decodePath(path))
}

export function fetchFile(path: string): Promise<FileResponse> {
    return client.get(`file?path=${encodedPath(path)}`)
}

export function getFileDownloadUrl(path: string): string {
    return `${BASE_URL}download?path=${encodedPath(path)}`
}

export function getFilePreviewUrl(path: string): string {
    return `${BASE_URL}download?path=${encodedPath(path)}&raw=true`
}

export function uploadFiles(
    directory: string,
    files: File[],
    onProgress: (fileName: string, progress: number) => void,
    overwrite = false,
): Promise<void> {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file, file.name))
    const suffix = overwrite ? '&overwrite=true' : ''
    return client.post(`upload?path=${encodedPath(directory)}${suffix}`, formData, {
        onUploadProgress: (event: AxiosProgressEvent) => {
            if (files.length === 1) {
                onProgress(files[0].name, Math.round((event.loaded / (event.total || 1)) * 100))
            }
        },
    })
}

export function deleteFileOrFolder(path: string): Promise<void> {
    return client.delete(`file?path=${encodedPath(path)}`)
}
