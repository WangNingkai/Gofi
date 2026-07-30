import client from '@/shared/api/client'

export const PermissionName = {
    FileListPageAccess: 'FileListPageAccess',
    FileUpload: 'FileUpload',
    FileDownload: 'FileDownload',
    FilePreview: 'FilePreview',
    FileRemove: 'FileRemove',
} as const

export type PermissionName = typeof PermissionName[keyof typeof PermissionName]

export interface GuestPermission {
    roleType: number
    name: PermissionName
    category: 'PageAccess' | 'DataOperation'
    enable: boolean
}

export function fetchGuestPermissions(): Promise<GuestPermission[]> {
    return client.get('permission/guest')
}
