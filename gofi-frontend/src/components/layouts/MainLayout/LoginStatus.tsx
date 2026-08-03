import { LogIn, LogOut, Settings, UserRound } from 'lucide-react'
import { useSetAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import QueryKey from '../../../constants/swr'
import { useCurrentUser } from '../../../hook/user'
import { tokenState } from '../../../states/common.state'
import { logout } from '@/features/auth/api'
import { clearSessionToken } from '@/features/auth/session'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const LoginStatus: React.FC = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useCurrentUser()
    const setToken = useSetAtom(tokenState)
    const { mutate } = useSWRConfig()

    const handleLogout = async () => {
        try {
            await logout()
        } finally {
            setToken(null)
            clearSessionToken()
            toast.dismiss('require-login')
            await mutate(QueryKey.CURRENT_USER)
            toast.success(t('toast.logout-success'))
            navigate('/auth/login', { replace: true })
        }
    }

    return (
        <div className="flex h-full">
            {user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button type="button" className="flex h-9 items-center gap-2 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={user.username}>
                            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary">
                                <UserRound className="h-3.5 w-3.5" />
                            </span>
                            <span className="hidden max-w-24 truncate text-xs font-medium sm:block">{user.username}</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="truncate">{user.username}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/admin/setting')}>
                            <Settings className="mr-2 h-4 w-4" />
                            {t('menu.setting')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleLogout()}>
                            <LogOut className="mr-2 h-4 w-4" />
                            {t('menu.logout')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Link to="/auth/login" className="flex h-9 items-center gap-2 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={t('menu.login')}>
                    <LogIn className="h-4 w-4" />
                    <span className="hidden text-xs font-medium sm:block">{t('menu.login')}</span>
                </Link>
            )}
        </div>
    )
}

export default LoginStatus
