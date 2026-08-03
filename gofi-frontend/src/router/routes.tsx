import React, { lazy } from 'react'
import { Navigate, RouteObject } from 'react-router'
import ProtectedRoute from './ProtectedRoute'
import PublicRoute from './PublicRoute'
import FileAccessRoute from './FileAccessRoute'

const NotFound = lazy(() => import('../pages/exception/404'))
const UnAuthorized = lazy(() => import('../pages/exception/403'))
const ServerError = lazy(() => import('../pages/exception/500'))
const Setting = lazy(() => import('../pages/admin/setting/Index'))
const FileRouter = lazy(() => import('../pages/file/FileRouter'))
const Login = lazy(() => import('../pages/Login'))
const Setup = lazy(() => import('../pages/Setup'))
const Shared = lazy(() => import('../pages/Shared'))

export const setupRoutes: RouteObject[] = [
    {
        path: '/shared/:token',
        element: <Shared />,
    },
    {
        path: '/setup',
        element: <Setup />,
    },
    {
        path: '*',
        element: <Navigate to="/setup" replace />,
    },
]

export const appRoutes: RouteObject[] = [
    {
        path: '/shared/:token',
        element: <Shared />,
    },
    {
        element: <PublicRoute />,
        children: [{ path: '/auth/login', element: <Login /> }],
    },
    {
        path: '/404',
        element: <NotFound />,
    },
    {
        path: '/403',
        element: <UnAuthorized />,
    },
    {
        path: '/500',
        element: <ServerError />,
    },
    {
        element: <FileAccessRoute />,
        children: [
            {
                path: '/',
                element: <Navigate to="/file/" replace />,
            },
            {
                path: '/file/*',
                element: <FileRouter />,
            },
        ],
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/admin/setting',
                element: <Setting />,
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/404" replace />,
    },
]
