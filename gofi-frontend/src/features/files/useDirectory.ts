import useSWR from 'swr'
import QueryKey from '@/constants/swr'
import { fetchFile } from './api'
import type { DirectoryData } from './types'

export function useDirectory(path: string, initial?: DirectoryData) {
    const result = useSWR(
        !path ? null : [QueryKey.FILE_LIST, path],
        async ([, directoryPath]) => {
            const response = await fetchFile(directoryPath)
            if (response.type !== 'directory') {
                throw new Error('Expected a directory response')
            }
            return response.data as DirectoryData
        },
        {
            fallbackData: initial,
            revalidateOnMount: !initial,
        },
    )

    return {
        files: result.data?.files,
        error: result.error,
        isLoading: result.isLoading,
        isValidating: result.isValidating,
        refresh: result.mutate,
    }
}
