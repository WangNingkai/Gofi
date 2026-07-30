import {
    Database,
    Shield,
    Monitor,
    X,
    Edit3,
    Check,
    Loader2
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { changePassword } from '@/features/auth/api'
import { fetchAdminConfiguration, updateStoragePath } from '@/features/configuration/api'
import MainLayout from '../../../components/layouts/MainLayout/Index'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import QueryKey from '../../../constants/swr'
import { useCurrentUser } from '../../../hook/user'
import Toast from '../../../utils/toast.util'
import { Card, CardContent } from '../../../components/ui/card'
import { Label } from '../../../components/ui/label'
import { RiSettings2Line } from 'react-icons/ri'
import PageHeader from '../../../components/PageHeader'
import { clearSessionToken } from '@/features/auth/session'
import { tokenState } from '@/states/common.state'
import { useSetAtom } from 'jotai'
import { useNavigate } from 'react-router-dom'
import ShareManager from '@/features/shares/ShareManager'

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
    const { data: config, mutate } = useSWR(QueryKey.CONFIG_DETAILS, fetchAdminConfiguration)

    useEffect(() => {
        if (config) {
            const path = config.customStoragePath || config.defaultStoragePath
            setCurrentStoragePath(path)
            setStoragePathInput(path)
        }
    }, [config])

    // 修改文件仓库路径
    const handleStoragePathSubmit = async () => {
        if (!storagePathInput?.trim()) {
            Toast.e(t('pages.setting.storage-change-failed'))
            return
        }

        try {
            setProcessing(true)
            await updateStoragePath(storagePathInput)
            await mutate()
            setEditingField(null)
            Toast.s(t('toast.storage-change-success'))
        } catch (error) {
            Toast.e(t('pages.setting.storage-change-failed'))
        } finally {
            setProcessing(false)
        }
    }

    // 修改密码
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
            setEditingField(null)
            setCurrentPasswordInput('')
            setPasswordInput('')
            setPasswordConfirmation('')
            clearSessionToken()
            setToken(null)
            Toast.s(t('toast.password-change-success'))
            navigate('/auth/login', { replace: true })
        } catch (error) {
            Toast.e(t('pages.setting.password-change-failed'))
        } finally {
            setProcessing(false)
        }
    }

    const cancelEdit = () => {
        setEditingField(null)
        setStoragePathInput(currentStoragePath)
        setCurrentPasswordInput('')
        setPasswordInput('')
        setPasswordConfirmation('')
    }

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* 页面标题 */}
                <PageHeader
                    icon={<RiSettings2Line className="h-6 w-6 text-primary" />}
                    title={t('pages.setting.title')}
                    description={t('pages.setting.description')}
                />

                {/* 合并后的设置卡片 */}
                <Card>
                    <CardContent className="space-y-8 pt-6">
                        {/* 系统信息 */}
                        <div>
                            <div className="flex items-center mb-2">
                                <Monitor className="h-5 w-5 mr-2 text-primary" />
                                <span className="font-semibold text-base">{t('pages.setting.system-info.title')}</span>
                                <Badge variant="secondary" className="ml-2">{t('common.read-only')}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mb-4">{t('pages.setting.system-info.description')}</div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{t('pages.setting.system-info.storage-path')}</span>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">
                                        {(config?.customStoragePath || config?.defaultStoragePath) ?? t('pages.setting.loading')}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{t('pages.setting.system-info.version')}</span>
                                <Badge variant="outline">{config?.version || t('pages.setting.loading')}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{t('pages.setting.system-info.current-user')}</span>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">
                                        {user?.username || t('common.unknown')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 分割线 */}
                        <div className="my-2 border-t" />

                        {/* 存储设置 */}
                        <div>
                            <div className="flex items-center mb-2">
                                <Database className="h-5 w-5 mr-2 text-primary" />
                                <span className="font-semibold text-base">{t('pages.setting.storage.title')}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mb-4">{t('pages.setting.storage.description')}</div>
                            <div className="space-y-2">
                                <Label htmlFor="storage-path">{t('pages.setting.storage.path-label')}</Label>
                                <div className="flex items-center space-x-2">
                                    {editingField === 'storage' ? (
                                        <>
                                            <Input
                                                id="storage-path"
                                                placeholder={t('form.setting.storage.path.placeholder')}
                                                value={storagePathInput}
                                                onChange={(e) => setStoragePathInput(e.target.value)}
                                                disabled={processing}
                                                className="h-8 px-3 text-sm rounded-md"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={cancelEdit}
                                                disabled={processing}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleStoragePathSubmit}
                                                disabled={processing || !storagePathInput?.trim()}
                                            >
                                                {processing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Check className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex-1 p-3 bg-muted/50 rounded-md text-sm h-8 flex items-center">
                                                {storagePathInput}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setEditingField('storage')}
                                                disabled={processing || editingField !== null}
                                            >
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{t('pages.setting.storage.alert')}</div>
                            </div>
                        </div>

                        {/* 分割线 */}
                        <div className="my-2 border-t" />

                        {/* 安全设置 */}
                        <div>
                            <div className="flex items-center mb-2">
                                <Shield className="h-5 w-5 mr-2 text-primary" />
                                <span className="font-semibold text-base">{t('pages.setting.security.title')}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mb-4">{t('pages.setting.security.description')}</div>
                            <div className="space-y-2">
                                <Label htmlFor="password">{t('pages.setting.security.password-label')}</Label>
                                <div className="flex items-center space-x-2">
                                    {editingField === 'password' ? (
                                        <>
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    id="current-password"
                                                    type="password"
                                                    autoComplete="current-password"
                                                    placeholder={t('form.setting.password.current-placeholder')}
                                                    value={currentPasswordInput}
                                                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                                                    disabled={processing}
                                                    className="h-8 px-3 text-sm rounded-md"
                                                />
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    placeholder={t('form.setting.password.placeholder')}
                                                    value={passwordInput}
                                                    onChange={(e) => setPasswordInput(e.target.value)}
                                                    disabled={processing}
                                                    className="h-8 px-3 text-sm rounded-md"
                                                />
                                                <Input
                                                    id="password-confirmation"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    placeholder={t('form.setting.password.confirm-placeholder')}
                                                    value={passwordConfirmation}
                                                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                                                    disabled={processing}
                                                    className="h-8 px-3 text-sm rounded-md"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={cancelEdit}
                                                disabled={processing}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handlePasswordSubmit}
                                                disabled={
                                                    processing ||
                                                    !currentPasswordInput ||
                                                    passwordInput.length < 10 ||
                                                    passwordInput !== passwordConfirmation
                                                }
                                            >
                                                {processing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Check className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex-1 p-3 bg-muted/50 rounded-md text-sm h-8 flex items-center">
                                                ••••••
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setEditingField('password')}
                                                disabled={processing || editingField !== null}
                                            >
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{t('pages.setting.security.alert')}</div>
                            </div>
                        </div>

                        <ShareManager />
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}

export default Setting
