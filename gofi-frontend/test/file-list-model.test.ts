import { describe, expect, it } from 'vitest'
import { fileTypeLabelKey, filterAndSortFiles } from '@/features/files/listModel'
import type { FileInfo } from '@/features/files/types'

function file(name: string, fileType = 'text', isDirectory = false): FileInfo {
    return {
        name,
        fileType,
        isDirectory,
        path: `/${name}`,
        size: 1,
        extension: '',
        mime: '',
        lastModified: 1,
        content: '',
        iconType: fileType,
    }
}

describe('file list model', () => {
    it('returns an empty result safely when a selected type has no files', () => {
        expect(filterAndSortFiles([file('readme.txt')], '', 'image')).toEqual([])
        expect(fileTypeLabelKey('image')).toBe('common.file-type.image')
    })

    it('filters case-insensitively and sorts folders first with natural names', () => {
        const result = filterAndSortFiles([
            file('file10.txt'),
            file('folder', 'folder', true),
            file('FILE2.txt'),
        ], 'file', 'all')
        expect(result.map((entry) => entry.name)).toEqual(['FILE2.txt', 'file10.txt'])

        const all = filterAndSortFiles([
            file('file10.txt'),
            file('folder', 'folder', true),
            file('file2.txt'),
        ], '', 'all')
        expect(all.map((entry) => entry.name)).toEqual(['folder', 'file2.txt', 'file10.txt'])
    })

    it('sorts by size or modified time while keeping folders first', () => {
        const older = { ...file('older.txt'), size: 20, lastModified: 1 }
        const newer = { ...file('newer.txt'), size: 10, lastModified: 2 }
        const folder = file('folder', 'folder', true)
        expect(filterAndSortFiles([older, newer, folder], '', 'all', 'size', 'asc').map((entry) => entry.name))
            .toEqual(['folder', 'newer.txt', 'older.txt'])
        expect(filterAndSortFiles([older, newer, folder], '', 'all', 'modified', 'desc').map((entry) => entry.name))
            .toEqual(['folder', 'newer.txt', 'older.txt'])
    })
})
