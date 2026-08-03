import {
    AlertTriangle,
    ArrowDownAZ,
    ArrowDownWideNarrow,
    ArrowUpDown,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    Copy,
    Eraser,
    Folder,
    FolderOpen,
    FolderPlus,
    Grid3X3,
    HardDrive,
    Home,
    List,
    MoreVertical,
    Move,
    Pencil,
    RefreshCw,
    Search,
    Share,
    Trash2,
    Upload,
    Filter,
    X,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import {
    copyFile,
    batchFiles,
    createDirectory,
    deleteFileOrFolder,
    getFileDownloadUrl,
    getFilePreviewUrl,
    moveFile,
    renameFile,
    uploadFiles as uploadFilesRequest,
} from '@/features/files/api'
import type { DirectoryData, FileInfo } from '@/features/files/types'
import FileIcon from '../../components/FileIcon'
import MainLayout from '../../components/layouts/MainLayout/Index'
import LogoLoading from '../../components/LogoLoading'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
    Dialog as ConfirmDialog, DialogContent as ConfirmDialogContent,
    DialogFooter as ConfirmDialogFooter,
    DialogHeader as ConfirmDialogHeader, DialogTitle as ConfirmDialogTitle,
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../../components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '../../components/ui/dropdown-menu'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { Separator } from '../../components/ui/separator'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '../../components/ui/tooltip'
import { UploadDialog } from '../../components/UploadDialog'
import { useAccessCapabilities } from '../../features/permissions/useAccessCapabilities'
import EnvUtil from '../../utils/env.util'
import { FormatUtil } from '../../utils/format.util'
import MimeTypeUtil from '../../utils/mimetype.util'
import Toast from '../../utils/toast.util'
import PageHeader from '../../components/PageHeader'
import PathUtil from '../../utils/path.util'
import { useDirectory } from '../../features/files/useDirectory'
import { createShare } from '@/features/shares/api'
import { searchFiles, type SearchResult } from '@/features/search/api'
import { readSessionToken } from '@/features/auth/session'
import { useAtom } from 'jotai'
import { fileViewModeState } from '@/features/preferences/fileViewMode'
import {
    fileTypeLabelKey,
    filterAndSortFiles,
    type FileSortKey,
    type FileTypeFilter,
    type SortDirection,
} from '@/features/files/listModel'

interface FilesProps {
    directoryData?: DirectoryData
}

const Files: React.FC<FilesProps> = ({ directoryData }) => {
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const uploadRef = useRef<HTMLInputElement>(null)
    const [uploadFiles, setUploadFiles] = useState<File[]>([])
    const [showUploadDialog, setShowUploadDialog] = useState(false)
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [viewMode, setViewMode] = useAtom(fileViewModeState)
    const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all')
    const [sortKey, setSortKey] = useState<FileSortKey>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [isDragActive, setIsDragActive] = useState(false)
    const { capabilities } = useAccessCapabilities()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [deletingItem, setDeletingItem] = useState<FileInfo | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [operation, setOperation] = useState<'mkdir' | 'rename' | 'copy' | 'move' | null>(null)
    const [operationItem, setOperationItem] = useState<FileInfo | null>(null)
    const [operationValue, setOperationValue] = useState('')
    const [operationLoading, setOperationLoading] = useState(false)
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
    const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false)
    const [batchLoading, setBatchLoading] = useState(false)
    const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
    const [overwriteFiles, setOverwriteFiles] = useState<File[]>([])
    const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([])
    const [overwriteUpload, setOverwriteUpload] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [indexedResults, setIndexedResults] = useState<SearchResult[]>([])
    const searchInputRef = useRef<HTMLInputElement>(null)
    const breadcrumbRef = useRef<HTMLDivElement>(null)

    const currentPath = useMemo(
        () => PathUtil.extractPathFromUrl(location.pathname),
        [location.pathname],
    )

    useEffect(() => {
        setSelectedPaths(new Set())
        setSearchQuery('')
        setFileTypeFilter('all')
    }, [currentPath])

    useEffect(() => {
        if (breadcrumbRef.current) {
            breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;
        }
    }, [currentPath]);

    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setSearchOpen(true)
            }
            if (event.key === 'Escape') setSearchOpen(false)
        }
        window.addEventListener('keydown', handleShortcut)
        return () => window.removeEventListener('keydown', handleShortcut)
    }, [])

    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setIndexedResults([])
            return
        }
        const timer = window.setTimeout(() => {
            void searchFiles(searchQuery, false).then(setIndexedResults).catch(() => setIndexedResults([]))
        }, 250)
        return () => window.clearTimeout(timer)
    }, [searchQuery])

    // 如果有传入的directoryData，优先使用，否则请求API
    const { files: fileInfos, error, refresh: mutate, isLoading: fetching, isValidating } =
        useDirectory(currentPath, directoryData)

    // 目录操作
    const hasParentDirectory = () => currentPath !== '/'
    const parentPath = () => {
        if (currentPath === '/' || !currentPath) return '/'
        const idx = currentPath.lastIndexOf('/')
        if (idx === 0) return '/'
        return currentPath.substring(0, idx)
    }

    // 生成面包屑路径
    const generateBreadcrumbs = () => {
        if (currentPath === '/') return [{ name: t('common.root-directory'), path: '/' }]

        const parts = currentPath.split('/').filter(Boolean)
        const breadcrumbs = [{ name: t('common.root-directory'), path: '/' }]

        let currentPathBuilder = ''
        parts.forEach((part) => {
            currentPathBuilder += '/' + part
            breadcrumbs.push({
                name: part,
                path: currentPathBuilder,
            })
        })
        return breadcrumbs
    }

    // 过滤文件列表
    const filteredFiles = useMemo(
        () => filterAndSortFiles(fileInfos, searchQuery, fileTypeFilter, sortKey, sortDirection),
        [fileInfos, fileTypeFilter, searchQuery, sortDirection, sortKey],
    )

    const toggleSort = (nextKey: FileSortKey) => {
        if (sortKey === nextKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
        else {
            setSortKey(nextKey)
            setSortDirection('asc')
        }
    }

    // 跳转
    const onFileNameClick = (fileinfo: FileInfo) => {
        if (fileinfo.isDirectory) {
            navigate(PathUtil.buildFileUrl(fileinfo.path))
        } else {
            if (!capabilities.preview) {
                Toast.e(t('pages.exception.403.description'))
                return
            }
            // 如果是图片文件，通过state传递当前目录的图片列表
            if (fileinfo.fileType === 'image' || MimeTypeUtil.previewableTypeOf(fileinfo.extension, fileinfo.mime) === 'image') {
                // 获取当前目录的所有图片文件
                const imageFiles = fileInfos?.filter(file => 
                    !file.isDirectory && 
                    (file.fileType === 'image' || MimeTypeUtil.previewableTypeOf(file.extension, file.mime) === 'image')
                ) || []
                
                // 找到当前图片在列表中的索引
                const currentIndex = imageFiles.findIndex(file => file.name === fileinfo.name)
                
                // 通过state传递图片列表数据
                const imageListData = {
                    imageList: imageFiles.map(file => getFilePreviewUrl(file.path)),
                    currentIndex: currentIndex >= 0 ? currentIndex : 0,
                    directoryPath: currentPath
                }
                
                navigate(PathUtil.buildFileUrl(fileinfo.path), {
                    state: { imageListData }
                })
            } else {
                navigate(PathUtil.buildFileUrl(fileinfo.path))
            }
        }
    }

    const navigateToRootDirectory = () => navigate('/file/')
    const navigateToParentDirectory = () => {
        if (!hasParentDirectory()) {
            Toast.i(t('toast.already-root-dir'))
            return
        }
        const targetUrl = PathUtil.buildFileUrl(parentPath())
        navigate(targetUrl)
    }

    const navigateToBreadcrumb = (path: string) => {
        const targetUrl = PathUtil.buildFileUrl(path)
        navigate(targetUrl)
    }

    // 获取文件类型标签
    const getFileTypeLabel = (fileInfo: FileInfo) => {
        if (fileInfo.isDirectory) {
            return t('common.file-type.folder')
        }

        switch (fileInfo.fileType) {
            case 'text':
                return t('common.file-type.text')
            case 'code':
                return t('common.file-type.code')
            case 'image':
                return t('common.file-type.image')
            case 'video':
                return t('common.file-type.video')
            case 'audio':
                return t('common.file-type.audio')
            case 'pdf':
                return t('common.file-type.pdf')
            case 'document':
                return t('common.file-type.document')
            case 'archive':
                return t('common.file-type.archive')
            case 'other':
            default:
                return t('common.file-type.file')
        }
    }

    // 获取文件图标
    const getFileIcon = (file: FileInfo) => {
        if (file.isDirectory) {
            return <FileIcon iconType="folder" className="h-5 w-5 text-primary" />
        }
        
        // 使用后端返回的图标类型
        if (file.iconType) {
            return <FileIcon iconType={file.iconType} className="h-5 w-5 text-muted-foreground" />
        }
        
        // 如果没有图标类型，使用默认文件图标
        return <FileIcon iconType="file" className="h-5 w-5 text-muted-foreground" />
    }

    // 上传
    const onUploadFiles = async (files: File[]) => {
        if (!fileInfos) {
            setUploadFiles(files)
            setShowUploadDialog(true)
            return
        }
        // 检查同名
        const existingNames = new Set(fileInfos.map(f => f.name))
        const conflictFiles = files.filter(f => existingNames.has(f.name))
        if (conflictFiles.length > 0) {
            setOverwriteFiles(conflictFiles)
            setPendingUploadFiles(files)
            setShowOverwriteDialog(true)
        } else {
            setUploadFiles(files)
            setShowUploadDialog(true)
        }
    }

    // 处理上传，增加 overwrite 支持
    const handleUpload = async (files: File[], onProgress?: (fileName: string, progress: number) => void, overwrite = false) => {
        try {
            await uploadFilesRequest(currentPath, files, onProgress || (() => {}), overwrite)
            await mutate()
        } catch (e: any) {
            throw new Error(e?.message || t('pages.file-list.upload-failed'))
        }
    }

    // 适配器，保证onUpload类型兼容UploadDialog
    const handleUploadAdapter = async (
        files: File[],
        onProgress?: (fileName: string, progress: number) => void,
        overwrite = false
    ) => {
        await handleUpload(
            files,
            onProgress
                ? (fileNameOrProgress: any, progressOrTotal: any) => {
                    if (typeof fileNameOrProgress === 'number' && typeof progressOrTotal === 'number') {
                        const percent = Math.round((fileNameOrProgress / (progressOrTotal || 1)) * 100)
                        files.forEach((file) => onProgress(file.name, percent))
                    } else {
                        onProgress(fileNameOrProgress, progressOrTotal)
                    }
                }
                : undefined,
            overwrite
        );
    };

    // 处理文件操作
    const handleDownload = (file: FileInfo) => {
        const downloadUrl = getFileDownloadUrl(file.path)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleShare = async (file: FileInfo) => {
        try {
            const share = await createShare(file.path, 24)
            const shareUrl = `${window.location.origin}/shared/${share.token}`
            if (navigator.share) {
                await navigator.share({
                    title: file.name,
                    url: shareUrl
                })
            } else {
                await navigator.clipboard.writeText(shareUrl)
                Toast.s(t('toast.link_copied'))
            }
        } catch (reason) {
            Toast.e(reason instanceof Error ? reason.message : t('pages.exception.403.description'))
        }
    }

    const handleDelete = (file: FileInfo) => {
        setDeletingItem(file)
        setShowDeleteDialog(true)
    }

    const confirmDelete = async () => {
        if (!deletingItem) return
        setDeleteLoading(true)
        try {
            await deleteFileOrFolder(deletingItem.path)
            Toast.s(t('pages.file-list.delete-success'))
            setShowDeleteDialog(false)
            setDeletingItem(null)
            mutate()
        } catch (e: any) {
            Toast.e(e?.message || t('toast.delete-failed'))
        } finally {
            setDeleteLoading(false)
        }
    }

    const openOperation = (kind: 'mkdir' | 'rename' | 'copy' | 'move', item: FileInfo | null = null) => {
        setOperation(kind)
        setOperationItem(item)
        setOperationValue(kind === 'rename' ? item?.name || '' : kind === 'mkdir' ? '' : currentPath)
    }

    const confirmOperation = async () => {
        if (!operation || !operationValue.trim()) return
        setOperationLoading(true)
        try {
            if (operation === 'mkdir') await createDirectory(currentPath, operationValue.trim())
            if (operation === 'rename' && operationItem) await renameFile(operationItem.path, operationValue.trim())
            if (operation === 'copy' && operationItem) {
                await copyFile(operationItem.path, `${operationValue.replace(/\/$/, '')}/${operationItem.name}`)
            }
            if (operation === 'move' && operationItem) {
                await moveFile(operationItem.path, `${operationValue.replace(/\/$/, '')}/${operationItem.name}`)
            }
            setOperation(null)
            await mutate()
        } catch (reason) {
            Toast.e(reason instanceof Error ? reason.message : t('pages.file-list.operation-failed'))
        } finally {
            setOperationLoading(false)
        }
    }

    const toggleSelected = (path: string) => {
        setSelectedPaths((current) => {
            const next = new Set(current)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }

    const confirmBatchDelete = async () => {
        setBatchLoading(true)
        try {
            const results = await batchFiles(Array.from(selectedPaths, (source) => ({ operation: 'delete', source })))
            const failed = results.filter((result) => !result.success)
            if (failed.length > 0) {
                Toast.e(t('pages.file-list.batch-partial', { count: failed.length }))
            } else {
                Toast.s(t('pages.file-list.delete-success'))
            }
            setSelectedPaths(new Set())
            setShowBatchDeleteDialog(false)
            await mutate()
        } catch (reason) {
            Toast.e(reason instanceof Error ? reason.message : t('pages.file-list.operation-failed'))
        } finally {
            setBatchLoading(false)
        }
    }

    // 渲染工具栏
    const renderToolbar = () => {
        const breadcrumbs = generateBreadcrumbs()
        const MAX_BREADCRUMBS_TO_SHOW = 4;
        return (
            <div className="sticky top-20 z-30 mb-6 space-y-2 rounded-xl border border-border bg-background/95 p-2 shadow-sm backdrop-blur">
                {/* 左侧：Home、Back、面包屑 */}
                <div className="flex items-center space-x-2 min-w-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={navigateToRootDirectory} className="h-8 w-8 p-0 flex-shrink-0">
                                    <Home className="h-4 w-4" />
                                    <span className="sr-only">{t('tooltip.home')}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('tooltip.home')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {hasParentDirectory() && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={navigateToParentDirectory} className="h-8 w-8 p-0">
                                        <ChevronLeft className="h-4 w-4" />
                                        <span className="sr-only">{t('tooltip.back')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('tooltip.back')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    {/* 面包屑导航 */}
                    <div
                        className="flex items-center text-sm text-muted-foreground min-w-0 overflow-x-auto whitespace-nowrap scrollbar-none"
                        ref={breadcrumbRef}
                    >
                        {breadcrumbs.length > MAX_BREADCRUMBS_TO_SHOW ? (
                            <>
                                {/* First item */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="px-1.5 py-1 rounded-md hover:bg-muted truncate"
                                                onClick={() => navigateToBreadcrumb(breadcrumbs[0].path)}
                                            >
                                                {breadcrumbs[0].name}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{breadcrumbs[0].name}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <ChevronRight className="h-4 w-4 flex-shrink-0" />

                                {/* Ellipsis with Tooltip for the full path */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="px-1.5 py-1 font-semibold">...</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{currentPath}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                
                                <ChevronRight className="h-4 w-4 flex-shrink-0" />

                                {/* Last two items */}
                                {breadcrumbs.slice(-2).map((crumb, index) => (
                                    <React.Fragment key={crumb.path}>
                                         <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {index === 1 ? (
                                                        <span className="px-1.5 py-1 font-semibold text-foreground" aria-current="page">
                                                            {crumb.name}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="px-1.5 py-1 rounded-md truncate hover:bg-muted"
                                                            onClick={() => navigateToBreadcrumb(crumb.path)}
                                                        >
                                                            {crumb.name}
                                                        </button>
                                                    )}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{crumb.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        {index < 1 && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                                    </React.Fragment>
                                ))}
                            </>
                        ) : (
                            // Show all breadcrumbs if they are not too long
                            breadcrumbs.map((crumb, index) => (
                                <React.Fragment key={crumb.path}>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                {index === breadcrumbs.length - 1 ? (
                                                    <span className="px-1.5 py-1 font-semibold text-foreground" aria-current="page">
                                                        {crumb.name}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="px-1.5 py-1 rounded-md truncate hover:bg-muted"
                                                        onClick={() => navigateToBreadcrumb(crumb.path)}
                                                    >
                                                        {crumb.name}
                                                    </button>
                                                )}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{crumb.name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                                </React.Fragment>
                            ))
                        )}
                    </div>
                </div>

                {/* 第二行：搜索、过滤、操作按钮 */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                    <div className="flex flex-wrap items-center gap-1">
                        {selectedPaths.size > 0 && capabilities.remove && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setShowBatchDeleteDialog(true)}
                                title={t('pages.file-list.batch-delete', { count: selectedPaths.size })}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        {/* 悬浮搜索框 */}
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 p-0"
                                aria-label={t('common.action.search')}
                                aria-expanded={searchOpen}
                                onClick={() => {
                                    setSearchOpen(true)
                                }}
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                            {searchOpen && (
                                <div
                                    className="absolute left-0 top-10 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-2 shadow-lg animate-in fade-in"
                                    onBlur={e => {
                                        // 失焦时收起（但点击输入框本身不收起）
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                            setSearchOpen(false)
                                        }
                                    }}
                                    tabIndex={-1}
                                >
                                    <div className="flex items-center gap-1">
                                        <Input
                                            ref={searchInputRef}
                                            placeholder={t('form.search.placeholder')}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="h-9 rounded-md text-sm"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 shrink-0"
                                            aria-label={t('common.close')}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => setSearchOpen(false)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {indexedResults.length > 0 && (
                                        <div className="mt-2 max-h-64 overflow-y-auto border-t pt-1">
                                            {indexedResults.slice(0, 10).map((result) => (
                                                <button
                                                    key={result.path}
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                        setSearchOpen(false)
                                                        navigate(PathUtil.buildFileUrl(result.path))
                                                    }}
                                                    className="block w-full truncate px-2 py-2 text-left text-xs hover:bg-muted"
                                                    title={result.path}
                                                >
                                                    <span className="font-medium">{result.name}</span>
                                                    <span className="ml-2 text-muted-foreground">{result.path}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* 文件类型过滤器图标化 */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                                    <Filter className="h-4 w-4" />
                                    <span className="sr-only">{t('common.action.filter')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setFileTypeFilter('all')} className={fileTypeFilter === 'all' ? 'bg-accent text-accent-foreground' : ''}>
                                    <Grid3X3 className="mr-2 h-4 w-4" />{t('common.file-type.all')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('folder')} className={fileTypeFilter === 'folder' ? 'bg-accent text-accent-foreground' : ''}>
                                    <Folder className="mr-2 h-4 w-4" />{t('common.file-type.folder')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('text')} className={fileTypeFilter === 'text' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="text" className="mr-2 h-4 w-4" />{t('common.file-type.text')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('code')} className={fileTypeFilter === 'code' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="code" className="mr-2 h-4 w-4" />{t('common.file-type.code')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('image')} className={fileTypeFilter === 'image' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="image" className="mr-2 h-4 w-4" />{t('common.file-type.image')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('video')} className={fileTypeFilter === 'video' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="video" className="mr-2 h-4 w-4" />{t('common.file-type.video')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('audio')} className={fileTypeFilter === 'audio' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="audio" className="mr-2 h-4 w-4" />{t('common.file-type.audio')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('pdf')} className={fileTypeFilter === 'pdf' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="pdf" className="mr-2 h-4 w-4" />{t('common.file-type.pdf')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('document')} className={fileTypeFilter === 'document' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="document" className="mr-2 h-4 w-4" />{t('common.file-type.document')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('archive')} className={fileTypeFilter === 'archive' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="archive" className="mr-2 h-4 w-4" />{t('common.file-type.archive')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFileTypeFilter('other')} className={fileTypeFilter === 'other' ? 'bg-accent text-accent-foreground' : ''}>
                                    <FileIcon iconType="other" className="mr-2 h-4 w-4" />{t('common.file-type.other')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label={t('common.action.sort')}>
                                    {sortDirection === 'asc'
                                        ? <ArrowDownAZ className="h-4 w-4" />
                                        : <ArrowDownWideNarrow className="h-4 w-4" />}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {(['name', 'modified', 'size'] as FileSortKey[]).map((key) => (
                                    <DropdownMenuItem
                                        key={key}
                                        onClick={() => toggleSort(key)}
                                        className={sortKey === key ? 'bg-accent text-accent-foreground' : ''}
                                    >
                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                        <span className="flex-1">{t(`common.sort.${key}`)}</span>
                                        {sortKey === key && (
                                            <span className="ml-4 text-xs text-muted-foreground">
                                                {t(`common.sort.${sortDirection === 'asc' ? 'ascending' : 'descending'}`)}
                                            </span>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* 上传文件按钮 */}
                        {capabilities.upload && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={() => openOperation('mkdir')} variant="ghost" size="sm" className="h-8 gap-2 px-2">
                                            <FolderPlus className="h-4 w-4" />
                                            <span className="hidden lg:inline">{t('pages.file-list.new-folder')}</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('pages.file-list.new-folder')}</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={() => {
                                        if (!capabilities.upload) {
                                            Toast.e(t('pages.exception.403.description'))
                                            return
                                        }
                                        uploadRef.current?.click()
                                    }} variant="default" size="sm" className="h-8 gap-2 px-2">
                                        <Upload className="h-4 w-4" />
                                        <span className="hidden lg:inline">{t('tooltip.upload')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('tooltip.upload')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {/* 刷新按钮 */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void mutate()}
                                        disabled={isValidating}
                                        aria-label={t('tooltip.refresh')}
                                        className="h-8 w-8 p-0"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('tooltip.refresh')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {/* 视图切换按钮 */}
                        <div className="flex items-center border border-border rounded-md">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                aria-label={t('pages.setting.display.grid')}
                                aria-pressed={viewMode === 'grid'}
                                className="h-8 w-8 p-0"
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                aria-label={t('pages.setting.display.list')}
                                aria-pressed={viewMode === 'list'}
                                className="h-8 w-8 p-0"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                        {EnvUtil.isPreviewMode && (
                            <>
                                <Separator orientation="vertical" className="h-6" />
                                <div className="hidden items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 sm:flex">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs text-amber-800 font-medium">{t('common.demo-mode')}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // 渲染文件列表
    const renderFileList = () => {
        if (fetching && !fileInfos) {
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

        if (error) {
            return (
                <Alert variant="destructive" className="my-8">
                    <AlertTitle>{t('pages.file-list.load-failed.title')}</AlertTitle>
                    <AlertDescription>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {t('pages.file-list.load-failed.message')}
                            <Button variant="outline" size="sm" onClick={() => void mutate()}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t('common.retry')}
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )
        }

        if (!fileInfos || fileInfos.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                        <Folder className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('pages.file-list.empty-folder.title')}</h3>
                    <p className="text-muted-foreground mb-6">{t('pages.file-list.empty-folder.description')}</p>
                    <Button onClick={() => uploadRef.current?.click()} disabled={!capabilities.upload}>
                        {t('pages.file-list.upload-files')}
                    </Button>
                </div>
            )
        }

        if ((searchQuery || fileTypeFilter !== 'all') && filteredFiles.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                        <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('form.search.no-results')}</h3>
                    <p className="text-muted-foreground">{t('form.search.try-different')}</p>
                </div>
            )
        }

        const filesToShow = filteredFiles

        return (
            <div className="space-y-4">
                {/* 统计信息 */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                        <span>{t('common.total-items', { count: filesToShow.length })}</span>
                        {(searchQuery || fileTypeFilter !== 'all') && (
                            <span className="text-primary flex items-center space-x-1">
                                {searchQuery && t('form.search.term', { term: searchQuery })}
                                {searchQuery && fileTypeFilter !== 'all' && ' | '}
                                {fileTypeFilter !== 'all' && (
                                    <>
                                        <FileIcon iconType={fileTypeFilter} className="inline-block w-4 h-4 mr-1 align-text-bottom" />
                                        {t(fileTypeLabelKey(fileTypeFilter))}
                                    </>
                                )}
                            </span>
                        )}
                        {(searchQuery || fileTypeFilter !== 'all') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('')
                                    setFileTypeFilter('all')
                                }}
                                className="ml-2 flex items-center px-3 py-1.5 rounded-md bg-primary text-white font-medium shadow hover:bg-primary/90 transition-colors text-sm"
                                type="button"
                            >
                                <Eraser className="w-4 h-4 mr-1" />
                                {t('form.filter.clear')}
                            </button>
                        )}
                    </div>
                    {fileInfos && (
                        <span>
                            {t('common.total-size')}: {FormatUtil.formatBytes(
                                fileInfos
                                    .filter(f => !f.isDirectory)
                                    .reduce((sum, f) => sum + f.size, 0)
                            )}
                        </span>
                    )}
                </div>

                {/* 文件列表 - 根据视图模式渲染 */}
                {viewMode === 'grid' ? (
                    /* 网格视图 */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filesToShow.map((item) => (
                            <div
                                key={item.path}
                                onClick={() => onFileNameClick(item)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        onFileNameClick(item)
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={item.isDirectory
                                    ? `${t('common.file-type.folder')}: ${item.name}`
                                    : `${t('common.file-type.file')}: ${item.name}`}
                                className="group relative bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                            >
                                {(capabilities.upload || capabilities.remove) && (
                                    <Checkbox
                                        checked={selectedPaths.has(item.path)}
                                        onCheckedChange={() => toggleSelected(item.path)}
                                        onClick={(event) => event.stopPropagation()}
                                        className="absolute bottom-3 right-3"
                                    />
                                )}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        {getFileIcon(item)}
                                        <Badge variant={item.isDirectory ? "default" : "secondary"}>
                                            {getFileTypeLabel(item)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        {(capabilities.download || capabilities.remove || capabilities.upload) && <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    aria-label={`${t('common.actions')}: ${item.name}`}
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {!item.isDirectory && capabilities.download && (
                                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDownload(item); }}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        {t('tooltip.download')}
                                                    </DropdownMenuItem>
                                                )}
                                                {!item.isDirectory && capabilities.download && readSessionToken() && (
                                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); void handleShare(item); }}>
                                                        <Share className="mr-2 h-4 w-4" />
                                                        {t('tooltip.share')}
                                                    </DropdownMenuItem>
                                                )}
                                                {capabilities.remove && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete(item); }} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {t('menu.delete')}
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {capabilities.upload && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={e => { e.stopPropagation(); openOperation('copy', item) }}>
                                                            <Copy className="mr-2 h-4 w-4" />{t('pages.file-list.copy')}
                                                        </DropdownMenuItem>
                                                        {capabilities.remove && <>
                                                            <DropdownMenuItem onClick={e => { e.stopPropagation(); openOperation('rename', item) }}>
                                                                <Pencil className="mr-2 h-4 w-4" />{t('pages.file-list.rename')}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={e => { e.stopPropagation(); openOperation('move', item) }}>
                                                                <Move className="mr-2 h-4 w-4" />{t('pages.file-list.move')}
                                                            </DropdownMenuItem>
                                                        </>}
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>}
                                    </div>
                                </div>
                                
                                <h3 className="font-medium text-foreground mb-2 truncate" title={item.name}>
                                    {item.name}
                                </h3>
                                
                                <div className="space-y-1 text-xs text-muted-foreground">
                                    {!item.isDirectory && (
                                        <div className="flex items-center space-x-1">
                                            <HardDrive className="h-3 w-3" />
                                            <span>{FormatUtil.formatBytes(item.size)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{FormatUtil.formatTime(item.lastModified * 1000)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* 列表视图 */
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground sm:table-cell">
                                            {t('common.file-name')}
                                        </th>
                                        <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground md:table-cell">
                                            {t('common.type')}
                                        </th>
                                        <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground lg:table-cell">
                                            {t('common.file-size')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                                            {t('common.last-modified')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                                            {t('common.actions')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filesToShow.map((item) => (
                                        <tr
                                            key={item.path}
                                            className="hover:bg-muted/50 transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center space-x-3">
                                                    {(capabilities.upload || capabilities.remove) && (
                                                        <Checkbox
                                                            checked={selectedPaths.has(item.path)}
                                                            onCheckedChange={() => toggleSelected(item.path)}
                                                            onClick={(event) => event.stopPropagation()}
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onFileNameClick(item)}
                                                        className="flex min-w-0 items-center gap-3 rounded text-left hover:text-primary"
                                                    >
                                                        {getFileIcon(item)}
                                                        <span className="max-w-[12rem] truncate font-medium text-foreground sm:max-w-[18rem]">
                                                            {item.name}
                                                        </span>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-3 sm:table-cell">
                                                <Badge variant={item.isDirectory ? "default" : "secondary"}>
                                                    {getFileTypeLabel(item)}
                                                </Badge>
                                            </td>
                                            <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                                                {item.isDirectory ? '--' : FormatUtil.formatBytes(item.size)}
                                            </td>
                                            <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                                                {FormatUtil.formatTime(item.lastModified * 1000)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center space-x-1">
                                                    {(capabilities.download || capabilities.remove || capabilities.upload) && <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                aria-label={`${t('common.actions')}: ${item.name}`}
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {!item.isDirectory && capabilities.download && (
                                                                <>
                                                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDownload(item); }}>
                                                                        <Download className="mr-2 h-4 w-4" />
                                                                        {t('tooltip.download')}
                                                                    </DropdownMenuItem>
                                                                    {readSessionToken() && <DropdownMenuItem onClick={e => { e.stopPropagation(); void handleShare(item); }}>
                                                                        <Share className="mr-2 h-4 w-4" />
                                                                        {t('tooltip.share')}
                                                                    </DropdownMenuItem>}
                                                                </>
                                                            )}
                                                            {capabilities.remove && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete(item); }} className="text-destructive">
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        {t('menu.delete')}
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            {capabilities.upload && <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={e => { e.stopPropagation(); openOperation('copy', item) }}>
                                                                    <Copy className="mr-2 h-4 w-4" />{t('pages.file-list.copy')}
                                                                </DropdownMenuItem>
                                                                {capabilities.remove && <>
                                                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); openOperation('rename', item) }}>
                                                                        <Pencil className="mr-2 h-4 w-4" />{t('pages.file-list.rename')}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); openOperation('move', item) }}>
                                                                        <Move className="mr-2 h-4 w-4" />{t('pages.file-list.move')}
                                                                    </DropdownMenuItem>
                                                                </>}
                                                            </>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <>
            <MainLayout>
                <div
                    className="relative space-y-6"
                    onDragOver={(event) => {
                        if (!capabilities.upload) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'copy'
                        setIsDragActive(true)
                    }}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setIsDragActive(false)
                        }
                    }}
                    onDrop={(event) => {
                        event.preventDefault()
                        setIsDragActive(false)
                        if (!capabilities.upload) {
                            Toast.e(t('pages.exception.403.description'))
                            return
                        }
                        const files = Array.from(event.dataTransfer.files)
                        if (files.length > 0) void onUploadFiles(files)
                    }}
                >
                    {isDragActive && (
                        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
                            <div className="flex max-w-sm flex-col items-center rounded-2xl border-2 border-dashed border-primary bg-card p-10 text-center shadow-xl">
                                <Upload className="mb-4 h-10 w-10 text-primary" />
                                <p className="font-semibold">{t('pages.file-list.drop-to-upload')}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{currentPath}</p>
                            </div>
                        </div>
                    )}
                    {/* 页面标题 */}
                    <PageHeader
                        icon={<FolderOpen className="h-6 w-6 text-primary" />}
                        title={t('pages.file-list.title')}
                        description={t('pages.file-list.description')}
                    />

                    {/* 工具栏 */}
                    {renderToolbar()}

                    {/* 文件列表 */}
                    {renderFileList()}
                </div>

                {/* 删除确认弹窗 */}
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {deletingItem ? t('pages.file-list.delete-title', { name: deletingItem.name }) : ''}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mb-4 text-sm text-muted-foreground">
                            {deletingItem && (
                                <div className="mt-2 border rounded bg-muted/30">
                                    <div className="flex px-3 py-1 text-xs text-muted-foreground font-medium border-b">
                                        <span className="flex-1 truncate">{t('common.file-name')}</span>
                                        <span className="w-24 text-center">{t('common.type')}</span>
                                        <span className="w-24 text-center">{t('common.file-size')}</span>
                                    </div>
                                    <div className="flex items-center px-3 py-1 text-sm border-b last:border-b-0 bg-background">
                                        <span className="flex-1 truncate">{deletingItem.name}</span>
                                        <span className="w-24 text-center">{getFileTypeLabel(deletingItem)}</span>
                                        <span className="w-24 text-center">{!deletingItem.isDirectory ? FormatUtil.formatBytes(deletingItem.size) : '--'}</span>
                                    </div>
                                </div>
                            )}
                            <div className="mt-2">
                                {deletingItem
                                    ? (deletingItem.isDirectory
                                        ? t('pages.file-list.delete-folder-desc')
                                        : t('pages.file-list.delete-file-desc'))
                                    : ''}
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" disabled={deleteLoading}>
                                    {t('form.cancel')}
                                </Button>
                            </DialogClose>
                            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('menu.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 覆盖确认弹窗 */}
                <ConfirmDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
                    <ConfirmDialogContent>
                        <ConfirmDialogHeader>
                            <ConfirmDialogTitle>
                                {t('pages.file-list.overwrite-title', { count: overwriteFiles.length })}
                            </ConfirmDialogTitle>
                        </ConfirmDialogHeader>
                        <div className="mb-4 text-sm text-muted-foreground">
                            {t('pages.file-list.overwrite-desc', { count: overwriteFiles.length })}
                            <div className="mt-2 border rounded bg-muted/30">
                                <div className="flex px-3 py-1 text-xs text-muted-foreground font-medium border-b">
                                    <span className="flex-1 truncate">{t('common.file-name')}</span>
                                    <span className="w-24 text-center">{t('common.type')}</span>
                                    <span className="w-24 text-center">{t('common.file-size')}</span>
                                </div>
                                {overwriteFiles.map(f => (
                                    <div
                                        key={f.name}
                                        className="flex items-center px-3 py-1 text-sm border-b last:border-b-0 bg-background"
                                        style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
                                    >
                                        <span className="flex-1 truncate">{f.name}</span>
                                        <span className="w-24 text-center">{t('common.file-type.file')}</span>
                                        <span className="w-24 text-center">{FormatUtil.formatBytes(f.size)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ConfirmDialogFooter>
                            <Button variant="outline" onClick={() => setShowOverwriteDialog(false)}>{t('form.cancel')}</Button>
                            <Button onClick={async () => {
                                setShowOverwriteDialog(false)
                                setShowUploadDialog(true)
                                setOverwriteUpload(true)
                                setUploadFiles(pendingUploadFiles)
                            }}>{t('pages.file-list.overwrite-confirm')}</Button>
                        </ConfirmDialogFooter>
                    </ConfirmDialogContent>
                </ConfirmDialog>

                <Dialog open={operation !== null} onOpenChange={(open) => !open && setOperation(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{operation ? t(`pages.file-list.operation.${operation}.title`) : ''}</DialogTitle>
                        </DialogHeader>
                        <Input
                            value={operationValue}
                            onChange={(event) => setOperationValue(event.target.value)}
                            placeholder={operation === 'mkdir' || operation === 'rename'
                                ? t('pages.file-list.name-placeholder')
                                : t('pages.file-list.destination-placeholder')}
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOperation(null)} disabled={operationLoading}>
                                {t('form.cancel')}
                            </Button>
                            <Button onClick={() => void confirmOperation()} disabled={operationLoading || !operationValue.trim()}>
                                {t('common.done')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('pages.file-list.batch-delete', { count: selectedPaths.size })}</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">{t('pages.file-list.batch-delete-description')}</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowBatchDeleteDialog(false)} disabled={batchLoading}>
                                {t('form.cancel')}
                            </Button>
                            <Button variant="destructive" onClick={() => void confirmBatchDelete()} disabled={batchLoading}>
                                <Trash2 className="mr-2 h-4 w-4" />{t('menu.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 隐藏的文件输入元素 */}
                <input
                    ref={uploadRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length > 0) {
                            onUploadFiles(files)
                        }
                        // 清空input值，允许重复选择相同文件
                        e.target.value = ''
                    }}
                />

                {/* 上传进度对话框 */}
                <UploadDialog
                    open={showUploadDialog}
                    onOpenChange={setShowUploadDialog}
                    files={uploadFiles}
                    canUpload={capabilities.upload}
                    onUpload={(files, onProgress) => handleUploadAdapter(files, onProgress, overwriteUpload)}
                    onSuccess={() => {
                        setOverwriteUpload(false)
                    }}
                    onError={() => {
                        setOverwriteUpload(false)
                    }}
                />
            </MainLayout>
        </>
    )
}

export default Files
