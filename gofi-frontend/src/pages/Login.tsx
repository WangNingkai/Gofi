import { useAtom, useSetAtom } from 'jotai'
import { FolderLock, Loader2, LogIn } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import logo from '@/assets/logo.svg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '@/features/auth/api'
import { writeSessionToken } from '@/features/auth/session'
import { languageState, tokenState } from '@/states/common.state'
import Toast from '@/utils/toast.util'
import ThemeSelect from '@/components/layouts/MainLayout/ThemeSelect'
import LangSelect from '@/components/layouts/MainLayout/LangSelect'

interface FormErrors {
    username?: string
    password?: string
}

const Login: React.FC = () => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const setToken = useSetAtom(tokenState)
    const [language, setLanguage] = useAtom(languageState)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [processing, setProcessing] = useState(false)
    const [errors, setErrors] = useState<FormErrors>({})

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        const nextErrors: FormErrors = {
            username: username.trim() ? undefined : t('form.login.validation.username-required'),
            password: password ? undefined : t('form.login.validation.password-required'),
        }
        if (nextErrors.username || nextErrors.password) {
            setErrors(nextErrors)
            return
        }

        setProcessing(true)
        setErrors({})
        try {
            const token = await login({ username, password })
            setToken(token)
            writeSessionToken(token)
            Toast.s(t('toast.login-success'))
            navigate('/', { replace: true })
        } catch (error) {
            Toast.e(error instanceof Error ? error.message : t('toast.login-failed'))
        } finally {
            setProcessing(false)
        }
    }

    return (
        <main className="relative grid min-h-screen place-items-center overflow-hidden bg-muted/20 px-4 py-8">
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute right-4 top-4 flex items-center rounded-xl border bg-background/80 p-0.5 shadow-sm backdrop-blur sm:right-6 sm:top-6">
                <ThemeSelect />
                <LangSelect selectLang={language} onSelect={setLanguage} />
            </div>
            <section className="relative w-full max-w-md space-y-7 rounded-2xl border bg-card/95 p-7 shadow-xl backdrop-blur sm:p-9">
                <header className="space-y-3 text-center">
                    <div className="mx-auto flex w-fit items-center gap-3">
                        <img className="h-11 w-auto" src={logo} alt="Gofi" />
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            <FolderLock className="mr-1 inline h-3.5 w-3.5" />Gofi
                        </span>
                    </div>
                    <h1 className="text-2xl font-semibold">{t('pages.login.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('pages.login.description')}</p>
                </header>

                <form className="space-y-5 border-t pt-6" onSubmit={handleSubmit}>
                    <label className="block space-y-2">
                        <span className="text-sm font-medium">{t('form.login.input.username')}</span>
                        <Input
                            autoComplete="username"
                            value={username}
                            disabled={processing}
                            aria-invalid={Boolean(errors.username)}
                            placeholder={t('form.login.input.username-placeholder')}
                            onChange={(event) => setUsername(event.target.value)}
                        />
                        {errors.username && <span className="text-sm text-destructive">{errors.username}</span>}
                    </label>
                    <label className="block space-y-2">
                        <span className="text-sm font-medium">{t('form.login.input.password')}</span>
                        <Input
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            disabled={processing}
                            aria-invalid={Boolean(errors.password)}
                            placeholder={t('form.login.input.password-placeholder')}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        {errors.password && <span className="text-sm text-destructive">{errors.password}</span>}
                    </label>
                    <Button type="submit" className="w-full" disabled={processing}>
                        {processing
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <LogIn className="mr-2 h-4 w-4" />}
                        {processing ? t('form.login.button.signing') : t('form.login.button.signin')}
                    </Button>
                </form>
            </section>
        </main>
    )
}

export default Login
