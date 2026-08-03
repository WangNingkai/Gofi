import React from 'react'
import { useLocation } from 'react-router'
import useSWR from 'swr'
import { fetchFile } from '@/features/files/api'
import type { DirectoryData, FileData } from '@/features/files/types'
import Files from './Files'
import File from './File'
import LogoLoading from '../../components/LogoLoading'
import QueryKey from '../../constants/swr'
import PathUtil from '../../utils/path.util'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/components/ui/button'
import Toast from '@/utils/toast.util'

const FileRouter: React.FC = () => {
    const location = useLocation()
    const { t } = useTranslation()

    // 从 URL 路径中提取文件路径
    const getFilePath = () => {
        return PathUtil.extractPathFromUrl(location.pathname)
    }

    const filePath = getFilePath()

    // 统一的文件/目录信息请求 - 只请求一次
    const { data: fileResponse, error, isLoading, mutate } = useSWR(
        filePath ? [QueryKey.FILE_DETAIL, filePath] : null,
        ([, path]) => fetchFile(path)
    )

    // 加载中显示加载动画
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <LogoLoading className="mb-4" />
                <div className="text-center mt-2">
                    <span className="text-sm text-muted-foreground font-medium">
                        {t('common.loading')}
                    </span>
                </div>
            </div>
        )
    }

    // 错误处理
    if (error) {
        const traceId = error instanceof ApiError ? error.traceId : undefined
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm">
                    <h2 className="text-xl font-semibold mb-2">{t('pages.file-list.load-failed.title')}</h2>
                    <p className="text-muted-foreground mb-4">{error.message}</p>
                    {traceId && (
                        <button
                            type="button"
                            className="mb-4 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => void navigator.clipboard.writeText(traceId).then(() => Toast.s(t('toast.trace-id-copied')))}
                        >
                            {t('common.trace-id')}: {traceId}
                        </button>
                    )}
                    <div className="flex justify-center gap-2">
                        <Button variant="outline" onClick={() => window.location.assign('/file/')}>{t('component.viewer.toolbar.root')}</Button>
                        <Button onClick={() => void mutate()}>{t('common.retry')}</Button>
                    </div>
                </div>
            </div>
        )
    }

    // 根据返回类型渲染对应组件
    if (fileResponse?.type === 'directory') {
        return <Files directoryData={fileResponse.data as DirectoryData} />
    } else if (fileResponse?.type === 'file') {
        return <File fileData={fileResponse.data as FileData} />
    }

    // 默认情况（根路径或未知类型）
    return <Files />
}

export default FileRouter
