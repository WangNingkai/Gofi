import React from 'react'
import { useTranslation } from 'react-i18next'
import ViewerToolbar from './ViewerToolbar'

interface IProps {
    url?: string

    // 工具栏简化属性
    currentPath?: string
    onReturn?: () => void
    onNewWindow?: () => void
    onDownload?: () => void
    onBackToOriginal?: () => void
    showBackToOriginal?: boolean
}

const VideoViewer: React.FC<IProps> = (props) => {
    const { t } = useTranslation()

    return (
        <div className="w-full h-full flex flex-col relative rounded-lg overflow-hidden">
            {/* 工具栏组件 */}
            <ViewerToolbar
                currentPath={props.currentPath}
                onReturn={props.onReturn}
                onNewWindow={props.onNewWindow}
                onDownload={props.onDownload}
            />
            {/* 视频播放器容器 - 适配视频长宽比 */}
            <div className="w-full bg-black overflow-hidden flex items-center justify-center h-[600px]">
                <video
                    src={props.url}
                    controls
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
