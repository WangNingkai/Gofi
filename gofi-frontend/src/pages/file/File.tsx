import { AlertTriangle, Download, File as FileIcon } from 'lucide-react'
import React, { lazy, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import useSWR from 'swr'
import { fetchFile, getFileDownloadUrl, getFilePathFromUrl, getFilePreviewUrl } from '@/features/files/api'
import type { DirectoryData, FileData, FileInfo } from '@/features/files/types'
import FileIconComponent from '../../components/FileIcon'
import MainLayout from '../../components/layouts/MainLayout/Index'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import QueryKey from '../../constants/swr'
import { FormatUtil } from '../../utils/format.util'
import MimeTypeUtil, { PreviewableFileType } from '../../utils/mimetype.util'
import PathUtil from '../../utils/path.util'
import { useAccessCapabilities } from '../../features/permissions/useAccessCapabilities'

const TextViewer = lazy(() => import('../../components/viewer/TextViewer'))
const AudioViewer = lazy(() => import('../../components/viewer/AudioViewer'))
const ImageViewer = lazy(() => import('../../components/viewer/ImageViewer'))
const PdfViewer = lazy(() => import('../../components/viewer/PdfViewer'))
const VideoViewer = lazy(() => import('../../components/viewer/VideoViewer'))

// 图片列表数据的接口
interface ImageListData {
    imageList: string[]
    currentIndex: number
    directoryPath: string
}

interface FileProps {
    fileData: FileData
}

const getCurrentDirectory = (filePath: string) => {
    const lastSlashIndex = filePath.lastIndexOf('/')
    return lastSlashIndex <= 0 ? '/' : filePath.substring(0, lastSlashIndex)
}

const File: React.FC<FileProps> = ({ fileData }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const [downloadUrl, setDownloadUrl] = useState<string>()
    const [previewUrl, setPreviewUrl] = useState<string>()
    const [fileInfo, setFileInfo] = useState<FileInfo>()
    const [previewableFileType, setPreviewableFileType] = useState<PreviewableFileType | null>(null)
    const [imageList, setImageList] = useState<string[]>([])
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [currentPath, setCurrentPath] = useState<string>('')
    const { t } = useTranslation()
    const { capabilities } = useAccessCapabilities()

    const currentFileInfo = fileData.file

    // 使用SWR获取目录文件列表
    const getDirectoryPath = (fileInfo: FileInfo) => {
        return getCurrentDirectory(fileInfo.path)
    }

    const { data: directoryFiles } = useSWR(
        currentFileInfo && previewableFileType === 'image'
            ? [QueryKey.FILE_LIST, getDirectoryPath(currentFileInfo)]
            : null,
        async ([, dirPath]) => {
            const response = await fetchFile(dirPath)
            if (response.type === 'directory') {
                return (response.data as DirectoryData).files
            }
            throw new Error('Path is not a directory')
        },
    )

    // 处理图片列表数据
    const processImageList = useCallback((fileInfo: FileInfo) => {
        // 首先尝试从location.state获取数据
        const stateData = location.state?.imageListData as ImageListData | undefined

        if (stateData && stateData.directoryPath === getCurrentDirectory(fileInfo.path)) {
            // 使用传递的数据
            setImageList(stateData.imageList)
            setCurrentImageIndex(stateData.currentIndex)

            // 更新预览URL为当前索引的图片
            if (stateData.imageList[stateData.currentIndex]) {
                setPreviewUrl(stateData.imageList[stateData.currentIndex])

                // 从预览URL中提取文件路径并更新下载URL
                const pathParam = getFilePathFromUrl(stateData.imageList[stateData.currentIndex])
                if (pathParam) {
                    setDownloadUrl(getFileDownloadUrl(pathParam))
                }

            }
            return
        }

        // 如果没有传递的数据，使用SWR获取的数据
        if (directoryFiles) {
            const imageFiles = directoryFiles.filter(
                (file) => !file.isDirectory && MimeTypeUtil.previewableTypeOf(file.extension, file.mime) === 'image',
            )

            const imageUrls = imageFiles.map((file) => getFilePreviewUrl(file.path))
            setImageList(imageUrls)

            // 找到当前图片在列表中的索引
            const currentIndex = imageFiles.findIndex((file) => file.name === fileInfo.name)
            const finalIndex = currentIndex >= 0 ? currentIndex : 0
            setCurrentImageIndex(finalIndex)

            // 更新预览URL为当前索引的图片
            if (imageUrls[finalIndex]) {
                setPreviewUrl(imageUrls[finalIndex])

                // 从预览URL中提取文件路径并更新下载URL
                const pathParam = getFilePathFromUrl(imageUrls[finalIndex])
                if (pathParam) {
                    setDownloadUrl(getFileDownloadUrl(pathParam))
                }

            }
        }
    }, [directoryFiles, location.state])

    useEffect(() => {
        if (currentFileInfo) {
            setFileInfo(currentFileInfo)
            setCurrentPath(currentFileInfo.path)

            // 根据扩展名/MIME判断预览类型
            const extension = currentFileInfo.extension?.toLowerCase() || ''
            const mime = currentFileInfo.mime || ''
            const hasContent = currentFileInfo.content !== undefined
            const backendFileType = currentFileInfo.fileType

            let result: PreviewableFileType | null = null

            if (hasContent) {
                // 如果有内容，优先使用内容判断
                result = MimeTypeUtil.previewableTypeOf(extension, mime)
            } else if (backendFileType) {
                // 否则使用后端返回的文件类型
                result = MimeTypeUtil.previewableTypeOf(extension, mime)
            }

            setPreviewableFileType(result)

            // 设置下载URL
            setDownloadUrl(getFileDownloadUrl(currentFileInfo.path))

            // 如果是图片，处理图片列表
            if (result === 'image') {
                processImageList(currentFileInfo)
            } else {
                // 非图片文件设置预览URL
                setPreviewUrl(getFilePreviewUrl(currentFileInfo.path))
            }
        }
    }, [currentFileInfo, processImageList])

    // 处理图片列表变化
    useEffect(() => {
        if (fileInfo && previewableFileType === 'image') {
            processImageList(fileInfo)
        }
    }, [fileInfo, previewableFileType, processImageList])

    // 处理图片切换
    const handleImageChange = useCallback(
        (newIndex: number) => {
            if (imageList[newIndex]) {
                setCurrentImageIndex(newIndex)
                setPreviewUrl(imageList[newIndex])

                // 从预览URL中提取文件路径并更新下载URL
                const pathParam = getFilePathFromUrl(imageList[newIndex])
                if (pathParam) {
                    setDownloadUrl(getFileDownloadUrl(pathParam))
                }

            }
        },
        [imageList],
    )

    const getFileIcon = (fileInfo: FileInfo | undefined, type: PreviewableFileType | null) => {
        if (!fileInfo) return <FileIcon className="h-5 w-5 text-muted-foreground" />

        if (type === 'image') {
            return <FileIconComponent iconType="image" className="h-5 w-5 text-muted-foreground" />
        } else if (type === 'video') {
            return <FileIconComponent iconType="video" className="h-5 w-5 text-muted-foreground" />
        } else if (type === 'audio') {
            return <FileIconComponent iconType="audio" className="h-5 w-5 text-muted-foreground" />
        } else if (type === 'pdf') {
            return <FileIconComponent iconType="pdf" className="h-5 w-5 text-muted-foreground" />
        } else if (type === 'text') {
            return <FileIconComponent iconType="text" className="h-5 w-5 text-muted-foreground" />
        } else {
            return <FileIconComponent iconType="file" className="h-5 w-5 text-muted-foreground" />
        }
    }

    const getFileTypeLabel = (fileInfo: FileInfo | undefined, type: PreviewableFileType | null) => {
        if (!fileInfo) return t('common.file-type.file')

        if (type === 'image') {
            return t('common.file-type.image')
        } else if (type === 'video') {
            return t('common.file-type.video')
        } else if (type === 'audio') {
            return t('common.file-type.audio')
        } else if (type === 'pdf') {
            return t('common.file-type.pdf')
        } else if (type === 'text') {
            return t('common.file-type.text')
        } else {
            return t('common.file-type.file')
        }
    }

    // 渲染文件预览组件
    const renderFilePreview = () => {
        const requiresDownload =
            previewableFileType !== 'text' || Boolean(fileInfo && fileInfo.size > 0 && !fileInfo.content)
        const onDownload = capabilities.download ? () => window.open(downloadUrl, '_blank') : undefined
        const onNewWindow = capabilities.download ? () => window.open(previewUrl, '_blank') : undefined

        if (requiresDownload && !capabilities.download) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t('pages.exception.403.title')}</h2>
                    <p className="text-muted-foreground">{t('pages.exception.403.description')}</p>
                </div>
            )
        }
        if (!fileInfo || !previewableFileType) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <FileIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t('pages.file-preview.no-preview.title')}</h2>
                    <p className="text-muted-foreground mb-4">{t('pages.file-preview.no-preview.description')}</p>
                    {onDownload && (
                        <Button onClick={onDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('common.download')}
                        </Button>
                    )}
                </div>
            )
        }

        switch (previewableFileType) {
            case 'text':
                return (
                    <TextViewer
                        url={previewUrl}
                        language={fileInfo.extension}
                        content={fileInfo.content}
                        fileInfo={{
                            name: fileInfo.name,
                            size: fileInfo.size,
                            extension: fileInfo.extension,
                        }}
                        currentPath={currentPath}
                        onReturn={() => navigate(PathUtil.buildFileUrl(PathUtil.parentPath(currentPath)))}
                        onDownload={onDownload}
                        onNewWindow={onNewWindow}
                    />
                )
            case 'image':
                return (
                    <ImageViewer
                        url={previewUrl}
                        imageList={imageList}
                        currentIndex={currentImageIndex}
                        onNavigate={handleImageChange}
                        onDownload={onDownload}
                        onNewWindow={onNewWindow}
                        onReturn={() => navigate(PathUtil.buildFileUrl(PathUtil.parentPath(currentPath)))}
                        currentPath={currentPath}
                        onNavigateBreadcrumb={(path) => navigate(PathUtil.buildFileUrl(path))}
                        onBackToOriginal={currentImageIndex !== 0 ? () => handleImageChange(0) : undefined}
                        showBackToOriginal={true}
                    />
                )
            case 'pdf':
                return (
                    <PdfViewer
                        url={previewUrl}
                        currentPath={currentPath}
                        onReturn={() => navigate(PathUtil.buildFileUrl(PathUtil.parentPath(currentPath)))}
                        onDownload={onDownload}
                        onNewWindow={onNewWindow}
                    />
                )
            case 'video':
                return (
                    <VideoViewer
                        url={previewUrl}
                        currentPath={currentPath}
                        onReturn={() => navigate(PathUtil.buildFileUrl(PathUtil.parentPath(currentPath)))}
                        onDownload={onDownload}
                        onNewWindow={onNewWindow}
                    />
                )
            case 'audio':
                return (
                    <AudioViewer
                        url={previewUrl}
                        currentPath={currentPath}
                        onReturn={() => navigate(PathUtil.buildFileUrl(PathUtil.parentPath(currentPath)))}
                        onDownload={onDownload}
                        onNewWindow={onNewWindow}
                    />
                )
            default:
                return (
                    <div className="flex flex-col items-center justify-center py-16">
                        <FileIcon className="h-12 w-12 text-muted-foreground mb-4" />
                        <h2 className="text-xl font-semibold mb-2">{t('pages.file-preview.no-preview.title')}</h2>
                        <p className="text-muted-foreground mb-4">{t('pages.file-preview.no-preview.description')}</p>
                        {onDownload && (
                            <Button onClick={onDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                {t('common.download')}
                            </Button>
                        )}
                    </div>
                )
        }
    }

    return (
        <MainLayout>
            {/* 文件信息头部 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    {getFileIcon(fileInfo, previewableFileType)}
                    <div>
                        <h1 className="text-2xl font-semibold">{fileInfo?.name}</h1>
                        <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary">{getFileTypeLabel(fileInfo, previewableFileType)}</Badge>
                            {fileInfo?.size && (
                                <span className="text-sm text-muted-foreground">
                                    {FormatUtil.formatBytes(fileInfo.size)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 文件预览区域 */}
            <div className="bg-background border rounded-lg">{renderFilePreview()}</div>
        </MainLayout>
    )
}

export default File
