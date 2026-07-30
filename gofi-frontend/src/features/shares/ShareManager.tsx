import React, { useEffect, useState } from 'react'
import { Ban, Link } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listShares, revokeShare, type ShareRecord } from './api'
import { Button } from '@/components/ui/button'
import Toast from '@/utils/toast.util'

export default function ShareManager() {
    const { t } = useTranslation()
    const [shares, setShares] = useState<ShareRecord[]>([])

    const refresh = () => {
        void listShares().then(setShares).catch((reason) => {
            Toast.e(reason instanceof Error ? reason.message : String(reason))
        })
    }

    useEffect(refresh, [])

    const revoke = async (id: number) => {
        try {
            await revokeShare(id)
            refresh()
        } catch (reason) {
            Toast.e(reason instanceof Error ? reason.message : String(reason))
        }
    }

    return (
        <section className="border-t pt-6">
            <div className="mb-4 flex items-center gap-2">
                <Link className="h-5 w-5" />
                <h2 className="text-base font-semibold">{t('pages.setting.shares.title')}</h2>
            </div>
            <div className="divide-y border-y">
                {shares.length === 0 &&
                    <p className="py-4 text-sm text-muted-foreground">{t('pages.setting.shares.empty')}</p>}
                {shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{share.path}</p>
                            <p className="text-xs text-muted-foreground">
                                {share.revoked
                                    ? t('pages.setting.shares.revoked')
                                    : t('pages.setting.shares.expires', { value: new Date(share.expiresAt).toLocaleString() })}
                            </p>
                        </div>
                        {!share.revoked &&
                            <Button variant="ghost" size="icon" onClick={() => void revoke(share.id)} title={t('pages.setting.shares.revoke')}>
                                <Ban className="h-4 w-4" />
                            </Button>}
                    </div>
                ))}
            </div>
        </section>
    )
}
