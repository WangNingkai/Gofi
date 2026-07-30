import { RiLoginBoxLine, RiLogoutBoxRLine } from 'react-icons/ri'
import { useSetAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import QueryKey from '../../../constants/swr'
import { useCurrentUser } from '../../../hook/user'
import { tokenState } from '../../../states/common.state'
import { logout } from '@/features/auth/api'
import { clearSessionToken } from '@/features/auth/session'

const buttonClass =
    'transition-all box-content h-full px-4 text-black-500 cursor-pointer flex items-center border-b-2 border-transparent text-gray-600 hover:text-indigo-500'
const textClass = 'ml-2 text-sm hidden sm:block'

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
                <button type="button" className={buttonClass} onClick={handleLogout}>
                    <RiLogoutBoxRLine />
                    <span className={textClass}>{t('menu.logout')}</span>
                </button>
            ) : (
                <Link to="/auth/login" className={buttonClass}>
                    <RiLoginBoxLine />
                    <span className={textClass}>{t('menu.login')}</span>
                </Link>
            )}
        </div>
    )
}

export default LoginStatus
