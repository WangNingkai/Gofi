import useSWR from 'swr'
import QueryKey from '@/constants/swr'
import { useCurrentUser } from '@/hook/user'
import { fetchGuestPermissions } from './api'
import { resolveAccessCapabilities } from './capabilities'

export function useAccessCapabilities() {
    const { user, isLoading: isUserLoading } = useCurrentUser()
    const { data, error, isLoading: isPermissionLoading } = useSWR(
        user ? null : QueryKey.GUEST_PERMISSIONS,
        fetchGuestPermissions,
    )

    const capabilities = resolveAccessCapabilities(Boolean(user), data)

    return {
        capabilities,
        error,
        isLoading: isUserLoading || (!user && isPermissionLoading),
        isAuthenticated: Boolean(user),
    }
}
