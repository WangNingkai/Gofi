import {
    Check,
    ClipboardCopy,
    Database,
    Edit3,
    LayoutGrid,
    LayoutList,
    Monitor,
    Shield,
    UserRound,
    X,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { useAtom, useSetAtom } from 'jotai'
import { useNavigate } from 'react-router'
import { RiSettings2Line } from 'react-icons/ri'
import { changePassword } from '@/features/auth/api'
import { clearSessionToken } from '@/features/auth/session'
import { fetchAdminConfiguration, updateStoragePath } from '@/features/configuration/api'
import { fileViewModeState, type FileViewMode } from '@/features/preferences/fileViewMode'
import ShareManager from '@/features/shares/ShareManager'
import { useCurrentUser } from '@/hook/user'
import { tokenState } from '@/states/common.state'
import Toast from '@/utils/toast.util'
import MainLayout from '@/components/layouts/MainLayout/Index'
import PageHeader from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import QueryKey from '@/constants/swr'
import { LoadingIndicator, LoadingStage } from '@/components/Loading'

const Setting: React.FC = () => {
    const [processing, setProcessing] = useState(false)
    const [storagePathInput, setStoragePathInput] = useState<string>()
    const [currentStoragePath, setCurrentStoragePath] = useState<string>()
    const [currentPasswordInput, setCurrentPasswordInput] = useState('')
    const [passwordInput, setPasswordInput] = useState('')
    const [passwordConfirmation, setPasswordConfirmation] = useState('')
    const [editingField, setEditingField] = useState<'storage' | 'password' | null>(null)
    const { t } = useTranslation()
    const { user } = useCurrentUser()
    const setToken = useSetAtom(tokenState)
    const navigate = useNavigate()
    const [fileViewMode, setFileViewMode] = useAtom(fileViewModeState)
    const { data: config, isLoading: isConfigLoading, mutate } = useSWR(QueryKey.CONFIG_DETAILS, fetchAdminConfiguration)

    useEffect(() => {
        if (config) {
            const path = config.customStoragePath || config.defaultStoragePath
            setCurrentStoragePath(path)
            setStoragePathInput(path)
        }
    }, [config])

    const cancelEdit = () => {
        setEditingField(null)
        setStoragePathInput(currentStoragePath)
        setCurrentPasswordInput('')
        setPasswordInput('')
        setPasswordConfirmation('')
    }

    const handleStoragePathSubmit = async () => {
        if (!storagePathInput?.trim()) {
            Toast.e(t('pages.setting.storage-change-failed'))
            return
        }
        try {
            setProcessing(true)
            await updateStoragePath(storagePathInput.trim())
            await mutate()
            setEditingField(null)
            Toast.s(t('toast.storage-change-success'))
        } catch {
            Toast.e(t('pages.setting.storage-change-failed'))
        } finally {
            setProcessing(false)
        }
    }

    const handlePasswordSubmit = async () => {
        if (!currentPasswordInput) {
            Toast.e(t('form.setting.password.validation.required'))
            return
        }
        if (passwordInput.length < 10) {
            Toast.e(t('form.setting.password.validation.min-length'))
            return
        }
        if (passwordInput !== passwordConfirmation) {
            Toast.e(t('pages.setup.error.password-match'))
            return
        }
        try {
            setProcessing(true)
            await changePassword({
                currentPassword: currentPasswordInput,
                password: passwordInput,
                confirm: passwordConfirmation,
            })
            cancelEdit()
            clearSessionToken()
            setToken(null)
            Toast.s(t('toast.password-change-success'))
            navigate('/auth/login', { replace: true })
        } catch {
            Toast.e(t('pages.setting.password-change-failed'))
        } finally {
            setProcessing(false)
        }
    }

    const copyStoragePath = async () => {
        if (!currentStoragePath) return
        await navigator.clipboard.writeText(currentStoragePath)
        Toast.s(t('toast.path-copied'))
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-5xl space-y-6">
                <PageHeader
                    icon={<RiSettings2Line className="h-5 w-5 text-primary" />}
                    title={t('pages.setting.title')}
                    description={t('pages.setting.description')}
                />

                <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-card to-primary/[0.03]">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Monitor className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{t('pages.setting.system-info.title')}</CardTitle>
                            <Badge variant="secondary">{t('common.read-only')}</Badge>
                        </div>
                        <CardDescription>{t('pages.setting.system-info.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border bg-background/70 p-4">
                            <Database className="mb-3 h-5 w-5 text-primary" />
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('pages.setting.system-info.storage-path')}</p>
                            <div className="mt-1 min-h-5 truncate text-sm font-medium" title={currentStoragePath}>
                                {currentStoragePath ?? <LoadingStage active variant="inline" delay={160} showLabel={false} size="sm" />}
                            </div>
                        </div>
                        <div className="rounded-xl border bg-background/70 p-4">
                            <Monitor className="mb-3 h-5 w-5 text-primary" />
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('pages.setting.system-info.version')}</p>
                            <div className="mt-1 min-h-5 text-sm font-medium">
                                {config?.version ?? <LoadingStage active variant="inline" delay={160} showLabel={false} size="sm" />}
                            </div>
                        </div>
                        <div className="rounded-xl border bg-background/70 p-4">
                            <UserRound className="mb-3 h-5 w-5 text-primary" />
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('pages.setting.system-info.current-user')}</p>
                            <p className="mt-1 text-sm font-medium">{user?.username ?? t('common.unknown')}</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                {fileViewMode === 'list' ? <LayoutList className="h-5 w-5 text-primary" /> : <LayoutGrid className="h-5 w-5 text-primary" />}
                                <CardTitle className="text-lg">{t('pages.setting.display.title')}</CardTitle>
                            </div>
                            <CardDescription>{t('pages.setting.display.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Label htmlFor="file-view-mode">{t('pages.setting.display.file-view-mode')}</Label>
                            <Select value={fileViewMode} onValueChange={(value) => setFileViewMode(value as FileViewMode)}>
                                <SelectTrigger id="file-view-mode"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="list">{t('pages.setting.display.list')}</SelectItem>
                                    <SelectItem value="grid">{t('pages.setting.display.grid')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs leading-relaxed text-muted-foreground">{t('pages.setting.display.alert')}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">{t('pages.setting.storage.title')}</CardTitle>
                            </div>
                            <CardDescription>{t('pages.setting.storage.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Label htmlFor="storage-path">{t('pages.setting.storage.path-label')}</Label>
                            {editingField === 'storage' ? (
                                <div className="space-y-3">
                                    <Input id="storage-path" value={storagePathInput ?? ''} onChange={(event) => setStoragePathInput(event.target.value)} disabled={processing} />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={cancelEdit} disabled={processing}><X className="h-4 w-4" />{t('form.cancel')}</Button>
                                        <Button onClick={() => void handleStoragePathSubmit()} disabled={processing || !storagePathInput?.trim()}>
                                            {processing ? <LoadingIndicator size="sm" label={t('common.status.loading')} /> : <Check className="h-4 w-4" />}
                                            {t('common.action.save')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs" title={currentStoragePath}>
                                        {currentStoragePath ?? <LoadingStage active variant="inline" delay={160} showLabel={false} size="sm" />}
                                    </div>
                                    <Button variant="outline" size="icon" onClick={() => void copyStoragePath()} disabled={isConfigLoading} aria-label={t('common.action.copy')}><ClipboardCopy className="h-4 w-4" /></Button>
                                    <Button variant="outline" onClick={() => setEditingField('storage')} disabled={editingField !== null || isConfigLoading}>
                                        <Edit3 className="h-4 w-4" />{t('common.action.edit')}
                                    </Button>
                                </div>
                            )}
                            <p className="text-xs leading-relaxed text-muted-foreground">{t('pages.setting.storage.alert')}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{t('pages.setting.security.title')}</CardTitle>
                        </div>
                        <CardDescription>{t('pages.setting.security.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {editingField === 'password' ? (
                            <div className="grid gap-3 md:grid-cols-3">
                                <Input type="password" autoComplete="current-password" aria-label={t('form.setting.password.current-placeholder')} placeholder={t('form.setting.password.current-placeholder')} value={currentPasswordInput} onChange={(event) => setCurrentPasswordInput(event.target.value)} disabled={processing} />
                                <Input type="password" autoComplete="new-password" aria-label={t('form.setting.password.placeholder')} placeholder={t('form.setting.password.placeholder')} value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} disabled={processing} />
                                <Input type="password" autoComplete="new-password" aria-label={t('form.setting.password.confirm-placeholder')} placeholder={t('form.setting.password.confirm-placeholder')} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} disabled={processing} />
                                <div className="flex justify-end gap-2 md:col-span-3">
                                    <Button variant="outline" onClick={cancelEdit} disabled={processing}><X className="h-4 w-4" />{t('form.cancel')}</Button>
                                    <Button onClick={() => void handlePasswordSubmit()} disabled={processing || !currentPasswordInput || passwordInput.length < 10 || passwordInput !== passwordConfirmation}>
                                        {processing ? <LoadingIndicator size="sm" label={t('common.status.loading')} /> : <Check className="h-4 w-4" />}
                                        {t('common.action.save')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                                <div>
                                    <p className="text-sm font-medium">{t('pages.setting.security.password-label')}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{t('pages.setting.security.alert')}</p>
                                </div>
                                <Button variant="outline" onClick={() => setEditingField('password')} disabled={editingField !== null}>
                                    <Edit3 className="h-4 w-4" />{t('common.action.edit')}
                                </Button>
                            </div>
                        )}
                        <ShareManager />
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}

export default Setting
