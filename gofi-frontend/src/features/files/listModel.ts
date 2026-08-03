import type { FileInfo } from './types'

export type FileTypeFilter = 'all' | 'folder' | 'text' | 'code' | 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'archive' | 'other'
export type FileSortKey = 'name' | 'modified' | 'size'
export type SortDirection = 'asc' | 'desc'

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function filterAndSortFiles(
    files: FileInfo[] | undefined,
    query: string,
    type: FileTypeFilter,
    sortKey: FileSortKey = 'name',
    direction: SortDirection = 'asc',
): FileInfo[] {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return [...(files ?? [])]
        .filter((file) => {
            const matchesQuery = !normalizedQuery || file.name.toLocaleLowerCase().includes(normalizedQuery)
            const matchesType = type === 'all'
                || (type === 'folder' ? file.isDirectory : !file.isDirectory && file.fileType === type)
            return matchesQuery && matchesType
        })
        .sort((left, right) => {
            if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1
            let result = 0
            if (sortKey === 'modified') result = left.lastModified - right.lastModified
            else if (sortKey === 'size') result = left.size - right.size
            else result = nameCollator.compare(left.name, right.name)
            return direction === 'asc' ? result : -result
        })
}

export function fileTypeLabelKey(type: FileTypeFilter): string {
    return `common.file-type.${type}`
}
