import { useAtomValue, useSetAtom } from 'jotai'
import useSWR from 'swr'
import { fetchCurrentUser } from '@/features/auth/api'
import QueryKey from '../constants/swr'
import { tokenState } from '../states/common.state'
import { clearSessionToken } from '@/features/auth/session'

export function useCurrentUser() {
    const setToken = useSetAtom(tokenState)
    const token = useAtomValue(tokenState)
    const {
        data: user,
        error,
        mutate,
        isLoading,
    } = useSWR(token ? [QueryKey.CURRENT_USER, token] : null, fetchCurrentUser, {
        onError: () => {
            setToken(null)
            clearSessionToken()
        },
    })

    return { user, isLoading, error, mutate }
}
