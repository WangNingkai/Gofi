import React from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingStage } from './Loading'

const PageLoading: React.FC = () => {
    const { t } = useTranslation()
    return <LoadingStage active variant="page" delay={200} label={t('pages.loading.title')} size="lg" />
}

export default PageLoading
