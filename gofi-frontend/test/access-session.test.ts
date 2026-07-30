import { afterEach, describe, expect, it } from 'vitest'
import { clearSessionToken, readSessionToken, writeSessionToken } from '../src/features/auth/session'
import { PermissionName, type GuestPermission } from '../src/features/permissions/api'
import { resolveAccessCapabilities } from '../src/features/permissions/capabilities'

function permission(name: GuestPermission['name'], enable: boolean): GuestPermission {
    return { roleType: 0, category: 'DataOperation', name, enable }
}

afterEach(() => sessionStorage.clear())

describe('会话边界', () => {
    it('统一写入、读取和清理会话令牌', () => {
        writeSessionToken('token')
        expect(readSessionToken()).toBe('token')
        clearSessionToken()
        expect(readSessionToken()).toBeNull()
    })
})

describe('访问能力矩阵', () => {
    it('登录用户拥有完整能力', () => {
        expect(resolveAccessCapabilities(true)).toEqual({
            list: true,
            preview: true,
            download: true,
            upload: true,
            remove: true,
        })
    })

    it('访客能力严格映射后端开关', () => {
        const capabilities = resolveAccessCapabilities(false, [
            permission(PermissionName.FileListPageAccess, true),
            permission(PermissionName.FileUpload, true),
            permission(PermissionName.FileDownload, false),
        ])
        expect(capabilities).toEqual({
            list: true,
            preview: false,
            download: false,
            upload: true,
            remove: false,
        })
    })
})
