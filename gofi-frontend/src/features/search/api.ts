import client from '@/shared/api/client'

export interface SearchResult {
    path: string
    name: string
    isDirectory: boolean
    size: number
    modified: number
}

export function searchFiles(query: string, includeContent = false): Promise<SearchResult[]> {
    const params = new URLSearchParams({
        q: query,
        content: String(includeContent),
        limit: '50',
    })
    return client.get(`search?${params}`)
}
