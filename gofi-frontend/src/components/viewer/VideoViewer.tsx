import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ViewerToolbar from './ViewerToolbar'
import { LoadingStage } from '@/components/Loading'

interface IProps {
    url?: string

    // 工具栏简化属性
    currentPath?: string
    onReturn?: () => void
    onRoot?: () => void
    onNewWindow?: () => void
    onDownload?: () => void
    onBackToOriginal?: () => void
    showBackToOriginal?: boolean
}

const VideoViewer: React.FC<IProps> = (props) => {
    const { t } = useTranslation()
    const [isLoading, setIsLoading] = useState(Boolean(props.url))

    useEffect(() => setIsLoading(Boolean(props.url)), [props.url])

    return (
        <div className="w-full h-full flex flex-col relative rounded-lg overflow-hidden">
            {/* 工具栏组件 */}
            <ViewerToolbar
                currentPath={props.currentPath}
                onReturn={props.onReturn}
                onRoot={props.onRoot}
                onNewWindow={props.onNewWindow}
                onDownload={props.onDownload}
            />
            {/* 视频播放器容器 - 适配视频长宽比 */}
            <div className="relative flex h-[calc(100dvh-12rem)] min-h-[360px] w-full items-center justify-center overflow-hidden bg-black" aria-busy={isLoading}>
                <LoadingStage active={isLoading} variant="overlay" delay={200} label={t('component.viewer.loading')} />
                <video
                    src={props.url}
                    controls
                    onLoadedData={() => setIsLoading(false)}
                    onError={() => setIsLoading(false)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                    }}
                >
                    {t('component.viewer.video-not-supported')}
                </video>
            </div>
        </div>
    )
}

export default VideoViewer
