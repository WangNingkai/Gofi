import React from 'react'
import useSWR from 'swr'
import { fetchConfiguration } from '@/features/configuration/api'
import QueryKey from '../constants/swr'
import { useTranslation } from 'react-i18next'

const Footer: React.FC = () => {
    const { t } = useTranslation()
    const { data: config } = useSWR(QueryKey.CONFIG, () => fetchConfiguration())

    return (
        <footer className="border-t bg-background/70">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 sm:flex-row">
                <nav>
                    <ul className="flex flex-wrap justify-center gap-4 text-xs font-medium text-muted-foreground">
                        <li>
                            <a
                                href="https://github.com/Sloaix/Gofi"
                                className="transition-colors underline-offset-4 hover:text-primary hover:underline"
                                target="_blank" rel="noopener noreferrer"
                            >
                                GitHub
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://gofi.calmlyfish.com"
                                className="transition-colors underline-offset-4 hover:text-primary hover:underline"
                                target="_blank" rel="noopener noreferrer"
                            >
                                {t('component.footer.about')}
                            </a>
                        </li>
                    </ul>
                </nav>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>{t('component.footer.version', { version: config?.version })}</span>
                    <span aria-hidden="true">·</span>
                    <span>© 2019-present</span>
                </div>
            </div>
        </footer>
    )
}

export default Footer
