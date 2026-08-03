import React, { useState } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { languageState } from '../../../states/common.state'
import Footer from '../../Footer'
import LangSelect from './LangSelect'
import LoginStatus from './LoginStatus'
import Logo from './Logo'
import NavMenu from './NavMenu'
import ThemeSelect from './ThemeSelect'
import EnvUtil from '../../../utils/env.util'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '../../ui/button'

interface IProps {
    children?: React.ReactNode
}

const MainLayout: React.FC<IProps> = ({ children }) => {
    const [language, setLanguage] = useAtom(languageState)
    const [showDemoBanner, setShowDemoBanner] = useState(true)
    const { t } = useTranslation()

    return (
        <div className="min-h-full w-full flex flex-col overflow-x-hidden bg-muted/20">
            {/* 演示模式提示条幅 */}
            {EnvUtil.isPreviewMode && showDemoBanner && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 relative">
                    <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-amber-800">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{t('common.demo-mode')}</span>
                        <span className="text-xs">{t('common.demo-mode.no-upload-download')}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDemoBanner(false)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-amber-600 hover:text-amber-800"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}
            
            <header className="sticky top-0 z-40 h-16 border-b bg-background/90 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 sm:px-6">
                <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-2">
                    <Logo />
                    <div className="min-w-0 flex-1">
                        <NavMenu />
                    </div>
                    <div className="flex h-10 shrink-0 items-center rounded-xl border bg-card/80 p-0.5 shadow-sm">
                        <ThemeSelect />
                        <LangSelect
                            selectLang={language}
                            onSelect={(lang: string) => setLanguage(lang)}
                        />
                        <LoginStatus />
                    </div>
                </div>
            </header>
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
            <Footer />
        </div>
    )
}

export default MainLayout
