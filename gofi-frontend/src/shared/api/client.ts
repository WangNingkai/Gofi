import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { LANGUAGE } from '@/constants/storage'
import EnvUtil from '@/utils/env.util'
import type { ApiResponse } from './types'
import { readSessionToken } from '@/features/auth/session'

const BASE_URL = EnvUtil.isDev ? 'http://localhost:8080/api/' : '/api/'

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code: number,
        public readonly cause?: unknown,
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

const transport = axios.create({
    baseURL: BASE_URL,
    timeout: 10_000,
    withCredentials: true,
})

transport.interceptors.request.use((request) => {
    const language = localStorage.getItem(LANGUAGE)
    const token = readSessionToken()
    if (language) {
        request.headers['Accept-Language'] = language
    }
    if (token) {
        request.headers.Authorization = `Bearer ${token}`
    }
    return request
})

transport.interceptors.response.use(
    (response) => {
        const payload = response.data as ApiResponse<unknown>
        if (!payload || payload.code !== 200 || !payload.success) {
            throw new ApiError(
                payload?.message || 'Request failed',
                response.status,
                payload?.code ?? -1,
            )
        }
        return payload.data as never
    },
    (error: AxiosError<ApiResponse<unknown>>) => {
        if (error instanceof ApiError) {
            return Promise.reject(error)
        }
        const status = error.response?.status ?? 0
        const code = error.response?.data?.code ?? -1
        const message = error.response?.data?.message || error.message || 'Network request failed'
        return Promise.reject(new ApiError(message, status, code, error))
    },
)

interface ApiClient {
    get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
    post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
    put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
    delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const client = transport as unknown as ApiClient

export { BASE_URL }
export default client
