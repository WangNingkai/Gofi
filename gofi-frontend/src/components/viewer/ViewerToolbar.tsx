import {
    ArrowLeft,
    ExternalLink,
    Download,
    Fullscreen,
    Home,
} from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbEllipsis,
} from '@/components/ui/breadcrumb'
import PathUtil from '@/utils/path.util'

export interface ViewerToolbarProps {
    // 通用功能
    onReturn?: () => void
    onRoot?: () => void
    onNewWindow?: () => void
    onDownload?: () => void
    onFullscreen?: () => void
    canFullscreen?: boolean
    isFullscreen?: boolean
    
    // 面包屑导航 - 简化接口，只需要路径
    currentPath?: string
    onNavigateBreadcrumb?: (path: string) => void
    
    // 其他
    className?: string
    children?: React.ReactNode // 用于插入特定Viewer的功能按钮
}

const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
    onReturn,
    onRoot,
    onNewWindow,
    onDownload,
    onFullscreen,
    canFullscreen = true,
    isFullscreen = false,
    currentPath,
    onNavigateBreadcrumb,
    className = '',
    children,
}) => {
    const { t } = useTranslation()
    const MAX_BREADCRUMBS_TO_SHOW = 4;

    // 生成面包屑数据
    const generateBreadcrumbs = () => {
        if (!currentPath) return [{ name: t('common.root-directory'), path: '/' }]

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

    // 处理面包屑导航
    const handleBreadcrumbNavigate = (path: string) => {
        if (onNavigateBreadcrumb) {
            onNavigateBreadcrumb(path)
        } else {
            // 如果没有提供回调，使用默认的导航逻辑
            const targetUrl = PathUtil.buildFileUrl(path)
            window.location.href = targetUrl
        }
    }

    // 替换根目录文本为"/"
    const displayBreadcrumbs = generateBreadcrumbs().map((b, i) => i === 0 ? { ...b, name: '/' } : b);
    
    return (
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 p-2 backdrop-blur-sm ${className}`}>
            {/* 左侧：返回、面包屑 */}
            <div className="flex items-center space-x-2 min-w-0">
                {/* 返回按钮 - 始终显示 */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={onReturn} 
                                className="h-8 w-8 p-0 flex-shrink-0"
                                disabled={!onReturn}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{t('component.viewer.toolbar.return')}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRoot}
                                className="h-8 w-8 flex-shrink-0 p-0"
                                disabled={!onRoot}
                                aria-label={t('component.viewer.toolbar.root')}
                            >
                                <Home className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{t('component.viewer.toolbar.root')}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                
                {/* 面包屑 - 使用shadcn组件 */}
                <div className="hidden min-w-0 rounded-md border border-border/50 bg-muted/50 px-2 py-1 sm:block">
                    <Breadcrumb>
                        <BreadcrumbList>
                            {displayBreadcrumbs && displayBreadcrumbs.length > 0 ? (
                                displayBreadcrumbs.length > MAX_BREADCRUMBS_TO_SHOW ? (
                                    <>
                                        {/* First item */}
                                        <BreadcrumbItem>
                                            <BreadcrumbLink
                                                onClick={() => handleBreadcrumbNavigate(displayBreadcrumbs[0].path)}
                                                className="cursor-pointer"
                                            >
                                                {displayBreadcrumbs[0].name}
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                        
                                        {/* Ellipsis */}
                                        <BreadcrumbItem>
                                            <BreadcrumbEllipsis />
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                        
                                        {/* Last two items */}
                                        {displayBreadcrumbs.slice(-2).map((crumb, index) => (
                                            <React.Fragment key={crumb.path}>
                                                <BreadcrumbItem>
                                                    {index === 1 ? (
                                                        <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                                                    ) : (
                                                        <BreadcrumbLink
                                                            onClick={() => handleBreadcrumbNavigate(crumb.path)}
                                                            className="cursor-pointer"
                                                        >
                                                            {crumb.name}
                                                        </BreadcrumbLink>
                                                    )}
                                                </BreadcrumbItem>
                                                {index < 1 && <BreadcrumbSeparator />}
                                            </React.Fragment>
                                        ))}
                                    </>
                                ) : (
                                    // Show all breadcrumbs if they are not too long
                                    displayBreadcrumbs.map((crumb, index) => (
                                        <React.Fragment key={crumb.path}>
                                            <BreadcrumbItem>
                                                {index === displayBreadcrumbs.length - 1 ? (
                                                    <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink
                                                        onClick={() => handleBreadcrumbNavigate(crumb.path)}
                                                        className="cursor-pointer"
                                                    >
                                                        {crumb.name}
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                            {index < displayBreadcrumbs.length - 1 && <BreadcrumbSeparator />}
                                        </React.Fragment>
                                    ))
                                )
                            ) : (
                                // 默认显示根目录
                                <BreadcrumbItem>
                                    <BreadcrumbPage>/</BreadcrumbPage>
                                </BreadcrumbItem>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                {/* 特定Viewer的功能按钮, 移到面包屑后面 */}
                <div className="flex max-w-[55vw] items-center overflow-x-auto">{children}</div>
            </div>

            {/* 右侧：通用功能按钮 */}
            <div className="ml-auto flex items-center gap-1">
                {/* 新窗口打开 */}
                {onNewWindow && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={onNewWindow} className="h-8 w-8 p-0" aria-label={t('common.open-in-new-tab')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('common.open-in-new-tab')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* 下载 */}
                {onDownload && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={onDownload} className="h-8 w-8 p-0" aria-label={t('common.download')}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('common.download')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* 全屏按钮 */}
                {canFullscreen && onFullscreen && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={onFullscreen} className="h-8 w-8 p-0" aria-label={isFullscreen ? t('component.viewer.toolbar.exit-fullscreen') : t('component.viewer.toolbar.fullscreen')}>
                                    <Fullscreen className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isFullscreen ? t('component.viewer.toolbar.exit-fullscreen') : t('component.viewer.toolbar.fullscreen')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )
}

export default ViewerToolbar
