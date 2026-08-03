import { describe, expect, it } from 'vitest'
import { getFilePathFromUrl } from '@/features/files/api'

describe('file URL parsing', () => {
    it('parses production relative preview URLs', () => {
        expect(getFilePathFromUrl('/api/download?path=%2Fimages%2Fcover.jpg&raw=true')).toBe('/images/cover.jpg')
    })

    it('parses development absolute preview URLs', () => {
        expect(getFilePathFromUrl('http://localhost:8080/api/download?path=%2Fimages%2Fcover.jpg&raw=true')).toBe(
            '/images/cover.jpg',
        )
    })
})
