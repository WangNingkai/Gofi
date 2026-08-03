import { describe, expect, it } from 'vitest'
import { isNavLinkActive } from '@/components/layouts/MainLayout/NavMenu'

describe('navigation active state', () => {
    it.each(['/file', '/file/', '/file/avatar.png'])(
        'selects the file navigation for %s',
        (pathname) => {
            expect(isNavLinkActive(pathname, '/file')).toBe(true)
        },
    )

    it('does not select routes that only share the same prefix', () => {
        expect(isNavLinkActive('/filename', '/file')).toBe(false)
    })
})
