import React, { useEffect, useState } from 'react'
import { Download, File, Folder, ShieldCheck } from 'lucide-react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { DirectoryData, FileInfo, FileResponse } from '@/features/files/types'
import { fetchSharedFile, sharedDownloadUrl } from '@/features/shares/api'
import { Button } from '@/components/ui/button'

export default function Shared() {
    const { t } = useTranslation()
    const { token = '' } = useParams()
    const [path, setPath] = useState('/')
    const [response, setResponse] = useState<FileResponse>()
    const [error, setError] = useState('')

    useEffect(() => {
        setError('')
        void fetchSharedFile(token, path).then(setResponse).catch((reason) => {
            setError(reason instanceof Error ? reason.message : String(reason))
        })
    }, [token, path])

    const open = (file: FileInfo) => {
        const childPath = `${path === '/' ? '' : path}/${file.name}`
        if (file.isDirectory) {
            setPath(childPath)
            return
        }
        window.location.href = sharedDownloadUrl(token, childPath)
    }

    return (
        <main className="mx-auto max-w-4xl px-4 py-10">
            <header className="mb-8 flex items-center gap-3 border-b pb-5">
                <ShieldCheck className="h-7 w-7 text-primary" />
                <div>
                    <h1 className="text-xl font-semibold">{t('pages.shared.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('pages.shared.description')}</p>
                </div>
            </header>
            {error && <p className="rounded border border-destructive p-4 text-destructive">{error}</p>}
            {response?.type === 'file' && (() => {
                const file = response.data as { file: FileInfo }
                return (
                    <div className="flex items-center justify-between border-b py-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <File className="h-5 w-5" />
                            <span className="truncate">{file.file.name}</span>
                        </div>
                        <Button asChild>
                            <a href={sharedDownloadUrl(token)}><Download className="mr-2 h-4 w-4" />{t('tooltip.download')}</a>
                        </Button>
                    </div>
                )
            })()}
            {response?.type === 'directory' &&
                <div className="divide-y border-y">
                    {(response.data as DirectoryData).files.map((file) =>
                        <button
                            key={file.path}
                            type="button"
                            onClick={() => open(file)}
                            className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-muted"
                        >
                            {file.isDirectory ? <Folder className="h-5 w-5" /> : <File className="h-5 w-5" />}
                            <span className="truncate">{file.name}</span>
                        </button>
                    )}
                </div>}
        </main>
    )
}
