import useSWR from 'swr'
import QueryKey from '@/constants/swr'
import { fetchFile } from './api'
import type { DirectoryData } from './types'

export function useDirectory(path: string, initial?: DirectoryData) {
    const result = useSWR(
        initial || !path ? null : [QueryKey.FILE_LIST, path],
        async ([, directoryPath]) => {
            const response = await fetchFile(directoryPath)
            if (response.type !== 'directory') {
                throw new Error('Expected a directory response')
            }
            return response.data as DirectoryData
        },
    )

    return {
        files: initial?.files ?? result.data?.files,
        error: result.error,
        isLoading: !initial && result.isLoading,
        isValidating: result.isValidating,
        refresh: result.mutate,
    }
}
