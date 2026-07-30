import { TOKEN } from '@/constants/storage'

export function readSessionToken(): string | null {
    return sessionStorage.getItem(TOKEN)
}

export function writeSessionToken(token: string): void {
    sessionStorage.setItem(TOKEN, token)
}

export function clearSessionToken(): void {
    sessionStorage.removeItem(TOKEN)
}
