import React from 'react'
import { Navigate, Outlet } from 'react-router'
import PageLoading from '../components/PageLoading'
import { useCurrentUser } from '../hook/user'

const ProtectedRoute: React.FC = () => {
    const { user, isLoading } = useCurrentUser()

    if (isLoading) {
        return <PageLoading />
    }

    if (!user) {
        return <Navigate to="/auth/login" replace />
    }

    return <Outlet />
}

export default ProtectedRoute
