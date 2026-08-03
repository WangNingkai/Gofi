import React from 'react'
import { Toaster } from '@/components/ui/sonner'
import GofiRouter from '@/router'
import NetworkStatus from '@/components/NetworkStatus'
import AppErrorBoundary from '@/components/AppErrorBoundary'

const App = () => {
    return (
        <AppErrorBoundary>
            <GofiRouter />
            <NetworkStatus />
            <Toaster position="top-center" expand={true} richColors />
        </AppErrorBoundary>
    )
}

export default App
