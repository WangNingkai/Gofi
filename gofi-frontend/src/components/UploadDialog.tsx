import React, { useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, FileText, Loader2, Upload } from 'lucide-react'
import { RiCheckboxCircleFill, RiCloseCircleFill } from 'react-icons/ri'
import { useTranslation } from 'react-i18next'
import { useUploadTask } from '@/features/upload/useUploadTask'
import { overallUploadProgress } from '@/features/upload/task'
import { FormatUtil } from '@/utils/format.util'
import Toast from '@/utils/toast.util'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Progress } from './ui/progress'

interface UploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    files: File[]
    onUpload: (files: File[], onProgress: (fileName: string, progress: number) => void) => Promise<void>
    onSuccess?: () => void
    onError?: (error: string) => void
    canUpload?: boolean
}

export const UploadDialog: React.FC<UploadDialogProps> = ({
    open,
    onOpenChange,
    files,
    onUpload,
    onSuccess,
    onError,
    canUpload = true,
}) => {
    const { t } = useTranslation()
    const { tasks, error, isUploading, start } = useUploadTask(files, onUpload)
    const progress = overallUploadProgress(tasks)
    const startedRef = useRef(false)

    const startUpload = useCallback(async () => {
        if (!canUpload) {
            const message = t('pages.exception.403.description')
            onError?.(message)
            Toast.e(message)
            return
        }
        try {
            await start()
            Toast.s(t('toast.upload-success'))
            onSuccess?.()
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : t('pages.file-list.upload-failed')
            onError?.(message)
            Toast.e(message)
        }
    }, [canUpload, onError, onSuccess, start, t])

    useEffect(() => {
        if (!open) {
            startedRef.current = false
            return
        }
        if (files.length > 0 && !startedRef.current) {
            startedRef.current = true
            void startUpload()
        }
    }, [files.length, open, startUpload])

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!nextOpen && isUploading) return
            onOpenChange(nextOpen)
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                            <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle>{t('pages.file-list.upload-dialog.title')}</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t('pages.file-list.upload-dialog.subtitle', { count: files.length })}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="max-h-40 overflow-y-auto space-y-1">
                        {tasks.map((task) => (
                            <div key={task.file.name} className="p-2 bg-muted/20 rounded-md border">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-medium truncate">{task.file.name}</span>
                                            <span className="text-muted-foreground">{FormatUtil.formatBytes(task.file.size)}</span>
                                            {task.status === 'completed' && <RiCheckboxCircleFill className="text-green-600" />}
                                            {task.status === 'failed' && <RiCloseCircleFill className="text-destructive" />}
                                            {(task.status === 'pending' || task.status === 'uploading') &&
                                                <Loader2 className="animate-spin text-primary" />}
                                        </div>
                                        {task.status !== 'completed' && task.status !== 'failed' &&
                                            <Progress value={task.progress} className="h-1 mt-2" />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>{t('pages.file-list.upload-dialog.overall-progress')}</span>
                            <span className="text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        {error && <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>}
                        {error && <Button onClick={() => void startUpload()} disabled={isUploading}>{t('common.retry')}</Button>}
                        {!error && progress >= 100 &&
                            <Button onClick={() => onOpenChange(false)}>{t('common.done')}</Button>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
