import { PermissionName, type GuestPermission } from './api'

export interface AccessCapabilities {
    list: boolean
    preview: boolean
    download: boolean
    upload: boolean
    remove: boolean
}

const fullAccess: AccessCapabilities = {
    list: true,
    preview: true,
    download: true,
    upload: true,
    remove: true,
}

export function resolveAccessCapabilities(
    authenticated: boolean,
    permissions: GuestPermission[] = [],
): AccessCapabilities {
    if (authenticated) return fullAccess
    const enabled = new Set(
        permissions.filter((permission) => permission.enable).map((permission) => permission.name),
    )
    return {
        list: enabled.has(PermissionName.FileListPageAccess),
        preview: enabled.has(PermissionName.FilePreview),
        download: enabled.has(PermissionName.FileDownload),
        upload: enabled.has(PermissionName.FileUpload),
        remove: enabled.has(PermissionName.FileRemove),
    }
}
