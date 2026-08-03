import React from 'react'
import { Navigate, Outlet } from 'react-router'
import PageLoading from '@/components/PageLoading'
import { useAccessCapabilities } from '@/features/permissions/useAccessCapabilities'

const FileAccessRoute: React.FC = () => {
    const { capabilities, isLoading, isAuthenticated } = useAccessCapabilities()

    if (isLoading) {
        return <PageLoading />
    }
    if (!capabilities.list && !capabilities.preview) {
        return <Navigate to={isAuthenticated ? '/403' : '/auth/login'} replace />
    }
    return <Outlet />
}

export default FileAccessRoute
