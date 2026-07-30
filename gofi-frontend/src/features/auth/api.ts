import client from '@/shared/api/client'

export interface LoginInput {
    username: string
    password: string
}

export interface ChangePasswordInput {
    currentPassword: string
    password: string
    confirm: string
}

export interface CurrentUser {
    id: number
    roleType: number
    username: string
}

export function login(input: LoginInput): Promise<string> {
    return client.post('user/login', input)
}

export function fetchCurrentUser(): Promise<CurrentUser> {
    return client.get('user')
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
    return client.post('user/changePassword', input)
}

export function logout(): Promise<void> {
    return client.post('user/logout')
}
