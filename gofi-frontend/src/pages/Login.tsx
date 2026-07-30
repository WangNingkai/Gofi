import { useSetAtom } from 'jotai'
import { Loader2, LogIn } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.svg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '@/features/auth/api'
import { writeSessionToken } from '@/features/auth/session'
import { tokenState } from '@/states/common.state'
import Toast from '@/utils/toast.util'

interface FormErrors {
    username?: string
    password?: string
}

const Login: React.FC = () => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const setToken = useSetAtom(tokenState)
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
        <main className="min-h-screen grid place-items-center bg-background px-4 py-8">
            <section className="w-full max-w-sm space-y-6">
                <header className="space-y-3 text-center">
                    <img className="mx-auto h-11 w-auto" src={logo} alt="Gofi" />
                    <h1 className="text-2xl font-semibold">{t('pages.login.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('pages.login.description')}</p>
                </header>

                <form className="space-y-4 border-t pt-6" onSubmit={handleSubmit}>
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
