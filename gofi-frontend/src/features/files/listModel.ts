import type { FileInfo } from './types'

export type FileTypeFilter = 'all' | 'folder' | 'text' | 'code' | 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'archive' | 'other'

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function filterAndSortFiles(
    files: FileInfo[] | undefined,
    query: string,
    type: FileTypeFilter,
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
            return nameCollator.compare(left.name, right.name)
        })
}

export function fileTypeLabelKey(type: FileTypeFilter): string {
    return `common.file-type.${type}`
}
