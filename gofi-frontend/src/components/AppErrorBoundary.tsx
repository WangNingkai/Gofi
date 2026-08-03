import React from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

interface State {
    error?: Error
}

const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
    const { t } = useTranslation()
    return (
        <main className="grid min-h-screen place-items-center bg-muted/20 p-6">
            <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-lg">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-semibold">{t('component.exception.500.title')}</h1>
                <p className="mt-2 break-words text-sm text-muted-foreground">{error.message}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" asChild>
                        <a href="/file/"><Home className="mr-2 h-4 w-4" />{t('component.exception.back-home')}</a>
                    </Button>
                    <Button onClick={() => window.location.reload()}>
                        <RefreshCw className="mr-2 h-4 w-4" />{t('component.exception.refresh-page')}
                    </Button>
                </div>
            </section>
        </main>
    )
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
    state: State = {}

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[gofi:frontend-error]', {
            message: error.message,
            stack: error.stack,
            componentStack: info.componentStack,
            path: window.location.pathname,
        })
    }

    render() {
        if (!this.state.error) return this.props.children
        return <ErrorFallback error={this.state.error} />
    }
}
