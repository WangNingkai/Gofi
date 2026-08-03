import React, { useEffect, useState } from 'react'
import { RiRefreshLine, RiWifiOffLine } from 'react-icons/ri'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import Toast from '../utils/toast.util'
import { LoadingIndicator } from './Loading'

interface NetworkStatusProps {
    className?: string
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ className }) => {
    const { t } = useTranslation()
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [isChecking, setIsChecking] = useState(false)

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            Toast.s(t('toast.network-restored'))
        }
        const handleOffline = () => {
            setIsOnline(false)
            Toast.networkError(t('toast.network-disconnected'), t('toast.network-error-detail'))
        }
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [t])

    const handleRetry = async () => {
        setIsChecking(true)
        try {
            const response = await fetch('/api/configuration', { cache: 'no-cache' })
            if (!response.ok) throw new Error('health check failed')
            setIsOnline(true)
            Toast.s(t('toast.network-restored'))
        } catch {
            setIsOnline(false)
            Toast.networkError(t('toast.network-error'), t('toast.network-error-detail'))
        } finally {
            setIsChecking(false)
        }
    }

    if (isOnline) return null

    return (
        <div className={`fixed top-4 right-4 z-50 ${className ?? ''}`}>
            <div className="bg-destructive/90 border border-destructive/20 rounded-md p-3 shadow-lg">
                <div className="flex items-center space-x-2">
                    <RiWifiOffLine className="text-white h-4 w-4" />
                    <span className="text-white text-sm font-medium">{t('toast.network-error')}</span>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleRetry}
                        disabled={isChecking}
                        className="text-white hover:text-white hover:bg-white/20 h-6 w-6"
                        title={t('common.retry')}
                    >
                        {isChecking
                            ? <LoadingIndicator size="sm" label={t('common.status.loading')} className="text-white [&_.gofi-loading-track]:border-white/30 [&_.gofi-loading-orbit]:border-t-white" />
                            : <RiRefreshLine className="h-3 w-3" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default NetworkStatus
