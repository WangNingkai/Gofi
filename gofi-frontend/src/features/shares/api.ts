import client, { BASE_URL } from '@/shared/api/client'
import type { FileResponse } from '@/features/files/types'

export interface CreatedShare {
    id: number
    token: string
    path: string
    expiresAt: string
}

export interface ShareRecord {
    id: number
    path: string
    expiresAt: string
    revoked: boolean
    createdAt: string
}

export function createShare(path: string, expiresInHours = 24): Promise<CreatedShare> {
    return client.post('share', { path, expiresInHours })
}

export function listShares(): Promise<ShareRecord[]> {
    return client.get('share')
}

export function revokeShare(id: number): Promise<void> {
    return client.delete(`share/${id}`)
}

export function fetchSharedFile(token: string, path = '/'): Promise<FileResponse> {
    const params = new URLSearchParams({ path })
    return client.get(`shared/${encodeURIComponent(token)}?${params}`)
}

export function sharedDownloadUrl(token: string, path = '/', raw = false): string {
    const params = new URLSearchParams({ path })
    if (raw) params.set('raw', 'true')
    return `${BASE_URL}shared/${encodeURIComponent(token)}/download?${params}`
}
