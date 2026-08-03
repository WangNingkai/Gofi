import type { AxiosProgressEvent } from 'axios'
import PathUtil from '@/utils/path.util'
import client, { BASE_URL } from '@/shared/api/client'
import type { FileResponse } from './types'

export interface UploadSession {
    id: string
    size: number
    chunkSize: number
    chunkCount: number
    received: number[]
}

export interface BatchFileOperation {
    operation: 'delete' | 'copy' | 'move'
    source: string
    destination?: string
    overwrite?: boolean
}

export interface BatchFileResult {
    source: string
    success: boolean
    error?: string
}

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

export function getFilePathFromUrl(url: string): string | null {
    try {
        return new URL(url, window.location.origin).searchParams.get('path')
    } catch {
        return null
    }
}

export function uploadFiles(
    directory: string,
    files: File[],
    onProgress: (fileName: string, progress: number) => void,
    overwrite = false,
): Promise<void> {
    if (files.some((file) => file.size >= 8 << 20)) {
        return uploadFilesResumably(directory, files, onProgress, overwrite)
    }
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file, file.name))
    const suffix = overwrite ? '&overwrite=true' : ''
    return client.post(`upload?path=${encodedPath(directory)}${suffix}`, formData, {
        onUploadProgress: (event: AxiosProgressEvent) => {
            const progress = Math.round((event.loaded / (event.total || 1)) * 100)
            files.forEach((file) => onProgress(file.name, progress))
        },
    })
}

export function deleteFileOrFolder(path: string): Promise<void> {
    return client.delete(`file?path=${encodedPath(path)}`)
}

export function createDirectory(path: string, name: string): Promise<void> {
    return client.post('directory', { path, name })
}

export function renameFile(path: string, name: string, overwrite = false): Promise<void> {
    return client.post('file/rename', { path, name, overwrite })
}

export function copyFile(source: string, destination: string, overwrite = false): Promise<void> {
    return client.post('file/copy', { source, destination, overwrite })
}

export function moveFile(source: string, destination: string, overwrite = false): Promise<void> {
    return client.post('file/move', { source, destination, overwrite })
}

export function batchFiles(operations: BatchFileOperation[]): Promise<BatchFileResult[]> {
    return client.post('file/batch', operations)
}

async function uploadFilesResumably(
    directory: string,
    files: File[],
    onProgress: (fileName: string, progress: number) => void,
    overwrite: boolean,
): Promise<void> {
    for (const file of files) {
        await uploadFileResumably(directory, file, onProgress, overwrite)
    }
}

async function uploadFileResumably(
    directory: string,
    file: File,
    onProgress: (fileName: string, progress: number) => void,
    overwrite: boolean,
): Promise<void> {
    const chunkSize = 4 << 20
    const fingerprint = `gofi-upload:${directory}:${file.name}:${file.size}:${file.lastModified}`
    const fileHash = await sha256(file)
    let session: UploadSession | undefined
    const stored = localStorage.getItem(fingerprint)
    if (stored) {
        try {
            session = await client.get<UploadSession>(`upload/session/${stored}`)
        } catch {
            localStorage.removeItem(fingerprint)
        }
    }
    if (!session) {
        session = await client.post<UploadSession>('upload/session', {
            directory,
            name: file.name,
            size: file.size,
            chunkSize,
            sha256: fileHash,
            overwrite,
        })
        localStorage.setItem(fingerprint, session.id)
    }
    const received = new Set(session.received)
    for (let index = 0; index < session.chunkCount; index++) {
        if (!received.has(index)) {
            const chunk = file.slice(index * session.chunkSize, Math.min(file.size, (index + 1) * session.chunkSize))
            await client.put(`upload/session/${session.id}/chunk?index=${index}`, chunk, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Chunk-SHA256': await sha256(chunk),
                },
                timeout: 60_000,
            })
        }
        onProgress(file.name, Math.round(((index + 1) / Math.max(1, session.chunkCount)) * 100))
    }
    await client.post(`upload/session/${session.id}/complete`)
    localStorage.removeItem(fingerprint)
    onProgress(file.name, 100)
}

async function sha256(value: Blob): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await value.arrayBuffer())
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
