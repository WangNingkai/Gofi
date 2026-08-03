import React, { Suspense } from 'react'
import { BrowserRouter, useRoutes } from 'react-router'
import PageLoading from '../components/PageLoading'
import { appRoutes, setupRoutes } from './routes'
import InitGuard from './InitGuard'

declare global {
    interface Window {
        LOADED: boolean
    }
}

const AppRoutes: React.FC = () => {
    // 用InitGuard包裹原有路由
    const guardedRoutes = [
        {
            element: <InitGuard />,
            children: [
                ...setupRoutes,
                ...appRoutes,
            ],
        },
    ]
    return useRoutes(guardedRoutes)
}

const GofiRouter: React.FC = () => {
    return (
        <Suspense fallback={<PageLoading />}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </Suspense>
    )
}

export default GofiRouter
