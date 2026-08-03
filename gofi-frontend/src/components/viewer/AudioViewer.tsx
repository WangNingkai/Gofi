import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ViewerToolbar from './ViewerToolbar'
import { LoadingStage } from '@/components/Loading'

interface IProps {
    url?: string
    mime?: string
    
    // 工具栏简化属性
    currentPath?: string
    onReturn?: () => void
    onRoot?: () => void
    onNewWindow?: () => void
    onDownload?: () => void
    onBackToOriginal?: () => void
    showBackToOriginal?: boolean
}

const AudioViewer: React.FC<IProps> = (props) => {
    const { t } = useTranslation()
    const [isLoading, setIsLoading] = useState(Boolean(props.url))

    useEffect(() => setIsLoading(Boolean(props.url)), [props.url])
    
    return (
        <div className="relative flex h-[calc(100dvh-12rem)] min-h-[360px] w-full flex-col">
            {/* 工具栏组件 */}
            <ViewerToolbar
                currentPath={props.currentPath}
                onReturn={props.onReturn}
                onRoot={props.onRoot}
                onNewWindow={props.onNewWindow}
                onDownload={props.onDownload}
            />
            {/* 音频播放器 */}
            <div className="relative flex flex-1 items-center justify-center p-6" aria-busy={isLoading}>
                <LoadingStage active={isLoading} variant="overlay" delay={200} label={t('component.viewer.loading')} />
                <audio src={props.url} controls className="w-full max-w-md" onCanPlay={() => setIsLoading(false)} onError={() => setIsLoading(false)}>
                    {t('component.viewer.audio-not-supported')}
                </audio>
            </div>
        </div>
    )
}

export default AudioViewer
