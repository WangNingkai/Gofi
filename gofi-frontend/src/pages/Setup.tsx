import { AlertCircle, CheckCircle2, FolderOpen, LockKeyhole, UserRound } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import useSWR from 'swr'
import logo from '../assets/logo.svg'
import PageLoading from '../components/PageLoading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import QueryKey from '../constants/swr'
import { fetchConfiguration, setup } from '@/features/configuration/api'
import { LoadingIndicator } from '@/components/Loading'

const Setup: React.FC = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [storagePath, setStoragePath] = useState('')
    const [username, setUsername] = useState('admin')
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [processing, setProcessing] = useState(false)
    const [completed, setCompleted] = useState(false)
    const [formError, setFormError] = useState('')
    const { data: config, error: configError, mutate } = useSWR(
        QueryKey.CONFIG,
        fetchConfiguration,
    )

    const handleSubmit = async () => {
        if (username.trim().length < 3) {
            setFormError(t('pages.setup.error.username'))
            return
        }
        if (password.length < 10) {
            setFormError(t('pages.setup.error.password-length'))
            return
        }
        if (password !== confirmation) {
            setFormError(t('pages.setup.error.password-match'))
            return
        }

        setProcessing(true)
        setFormError('')
        try {
            const initialized = await setup({
                customStoragePath: storagePath.trim(),
                adminUsername: username.trim(),
                adminPassword: password,
            })
            await mutate(initialized, false)
            setCompleted(true)
        } catch (error) {
            setFormError(error instanceof Error ? error.message : t('pages.setup.error.config-failed'))
        } finally {
            setProcessing(false)
        }
    }

    if (!config && !configError) {
        return <PageLoading />
    }

    if (configError) {
        return (
            <main className="min-h-screen grid place-items-center bg-background px-4">
                <div className="w-full max-w-md space-y-4 text-center">
                    <AlertCircle className="mx-auto h-9 w-9 text-destructive" />
                    <h1 className="text-xl font-semibold">{t('pages.setup.error.load-failed.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('pages.setup.error.load-failed.desc')}</p>
                    <Button onClick={() => window.location.reload()}>
                        {t('component.exception.refresh-page')}
                    </Button>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen grid place-items-center bg-background px-4 py-8">
            <section className="w-full max-w-md space-y-6">
                <header className="space-y-2 text-center">
                    <img className="mx-auto h-10 w-auto" src={logo} alt="Gofi" />
                    <h1 className="text-2xl font-semibold">{t('pages.setup.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('pages.setup.desc')}</p>
                </header>

                {completed ? (
                    <div className="space-y-5 border-t pt-6 text-center">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                        <div>
                            <h2 className="text-lg font-semibold">{t('pages.setup.success.title')}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{t('pages.setup.success.desc')}</p>
                        </div>
                        <Button className="w-full" onClick={() => navigate('/auth/login', { replace: true })}>
                            {t('pages.setup.success.button')}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5 border-t pt-6">
                        <label className="block space-y-2">
                            <span className="flex items-center gap-2 text-sm font-medium">
                                <UserRound className="h-4 w-4" />
                                {t('pages.setup.admin-username')}
                            </span>
                            <Input
                                value={username}
                                autoComplete="username"
                                disabled={processing}
                                onChange={(event) => setUsername(event.target.value)}
                            />
                        </label>

                        <label className="block space-y-2">
                            <span className="flex items-center gap-2 text-sm font-medium">
                                <LockKeyhole className="h-4 w-4" />
                                {t('pages.setup.admin-password')}
                            </span>
                            <Input
                                type="password"
                                value={password}
                                autoComplete="new-password"
                                disabled={processing}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </label>

                        <label className="block space-y-2">
                            <span className="text-sm font-medium">{t('pages.setup.confirm-password')}</span>
                            <Input
                                type="password"
                                value={confirmation}
                                autoComplete="new-password"
                                disabled={processing}
                                onChange={(event) => setConfirmation(event.target.value)}
                            />
                        </label>

                        <label className="block space-y-2">
                            <span className="flex items-center gap-2 text-sm font-medium">
                                <FolderOpen className="h-4 w-4" />
                                {t('pages.setup.storage-path')}
                            </span>
                            <Input
                                value={storagePath}
                                disabled={processing}
                                placeholder={t('pages.setup.storage-path-optional')}
                                onChange={(event) => setStoragePath(event.target.value)}
                            />
                            <span className="block text-xs text-muted-foreground">
                                {t('pages.setup.help-text')}
                            </span>
                        </label>

                        {formError && (
                            <div role="alert" className="flex gap-2 text-sm text-destructive">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <Button className="w-full" disabled={processing} onClick={handleSubmit}>
                            {processing && <LoadingIndicator className="mr-2" size="sm" label={t('pages.setup.button.processing')} />}
                            {processing ? t('pages.setup.button.processing') : t('pages.setup.button.submit')}
                        </Button>
                    </div>
                )}
            </section>
        </main>
    )
}

export default Setup
