import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, File, Folder, Home, RefreshCw, ShieldCheck } from 'lucide-react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { DirectoryData, FileInfo, FileResponse } from '@/features/files/types'
import { fetchSharedFile, sharedDownloadUrl } from '@/features/shares/api'
import { Button } from '@/components/ui/button'
import logo from '@/assets/logo.svg'
import { FormatUtil } from '@/utils/format.util'
import { LoadingBar, LoadingSkeleton, LoadingStage } from '@/components/Loading'

export default function Shared() {
    const { t } = useTranslation()
    const { token = '' } = useParams()
    const [path, setPath] = useState('/')
    const [response, setResponse] = useState<FileResponse>()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [retryKey, setRetryKey] = useState(0)
    const requestVersion = useRef(0)

    useEffect(() => {
        const version = ++requestVersion.current
        setError('')
        setLoading(true)
        void fetchSharedFile(token, path)
            .then((value) => {
                if (version === requestVersion.current) setResponse(value)
            })
            .catch((reason) => {
                if (version === requestVersion.current) {
                    setError(reason instanceof Error ? reason.message : String(reason))
                }
            })
            .finally(() => {
                if (version === requestVersion.current) setLoading(false)
            })
    }, [token, path, retryKey])

    const parentPath = path === '/' ? '/' : path.slice(0, path.lastIndexOf('/')) || '/'

    const open = (file: FileInfo) => {
        const childPath = `${path === '/' ? '' : path}/${file.name}`
        if (file.isDirectory) {
            setPath(childPath)
            return
        }
        window.location.href = sharedDownloadUrl(token, childPath)
    }

    return (
        <main className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="Gofi" className="h-9 w-auto" />
                        <div>
                            <h1 className="flex items-center gap-2 text-xl font-semibold">
                                {t('pages.shared.title')}<ShieldCheck className="h-4 w-4 text-primary" />
                            </h1>
                            <p className="text-sm text-muted-foreground">{t('pages.shared.description')}</p>
                        </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{t('pages.shared.read-only')}</span>
                </header>
                <div className="relative flex items-center gap-2 border-b bg-muted/20 px-4 py-3">
                    <LoadingBar active={loading} label={t('common.status.loading')} className="absolute inset-x-0 bottom-0" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPath('/')} disabled={path === '/'} aria-label={t('component.viewer.toolbar.root')}>
                        <Home className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPath(parentPath)} disabled={path === '/'} aria-label={t('common.back')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={path}>{path}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRetryKey((value) => value + 1)} disabled={loading} aria-label={t('common.action.refresh')}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
                <section className="min-h-64 p-4 sm:p-6" aria-busy={loading}>
            {loading && !response && (
                <LoadingStage active delay={160} label={t('common.loading')}>
                    <LoadingSkeleton rows={3} />
                </LoadingStage>
            )}
            {error && (
                <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" onClick={() => setRetryKey((value) => value + 1)}>{t('common.retry')}</Button>
                </div>
            )}
            {!error && response?.type === 'file' && (() => {
                const file = response.data as { file: FileInfo }
                return (
                    <div className="flex items-center justify-between rounded-xl border p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <File className="h-5 w-5" />
                            <div className="min-w-0"><p className="truncate font-medium">{file.file.name}</p><p className="text-xs text-muted-foreground">{FormatUtil.formatBytes(file.file.size)}</p></div>
                        </div>
                        <Button asChild>
                            <a href={sharedDownloadUrl(token)}><Download className="mr-2 h-4 w-4" />{t('tooltip.download')}</a>
                        </Button>
                    </div>
                )
            })()}
            {!error && response?.type === 'directory' && (() => {
                const files = (response.data as DirectoryData).files
                if (files.length === 0) return <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-muted-foreground"><Folder className="h-10 w-10" /><p>{t('pages.file-list.empty-folder.title')}</p></div>
                return <div className={`divide-y rounded-xl border transition-opacity ${loading ? 'pointer-events-none opacity-60' : ''}`}>
                    {files.map((file) =>
                        <button
                            key={file.path}
                            type="button"
                            onClick={() => open(file)}
                            className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-muted"
                        >
                            {file.isDirectory ? <Folder className="h-5 w-5" /> : <File className="h-5 w-5" />}
                            <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                            {!file.isDirectory && <span className="text-xs text-muted-foreground">{FormatUtil.formatBytes(file.size)}</span>}
                        </button>
                    )}
                </div>
            })()}
                </section>
            </div>
        </main>
    )
}
