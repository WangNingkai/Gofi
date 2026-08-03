import { AxiosError } from 'axios'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import client from '@/shared/api/client'

beforeAll(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() })
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() })
})

describe('API error diagnostics', () => {
    it('preserves trace IDs from application-level failures', async () => {
        const request = client.get('test', {
            adapter: async (config) => ({
                data: { success: false, code: 50000, message: 'failed', traceId: 'trace-app' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
            }),
        })
        await expect(request).rejects.toMatchObject({
            message: 'failed',
            status: 200,
            code: 50000,
            traceId: 'trace-app',
        })
    })

    it('preserves trace IDs from HTTP failures', async () => {
        const request = client.get('test', {
            adapter: async (config) => {
                throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, undefined, {
                    data: { success: false, code: 50000, message: 'server failed', traceId: 'trace-http' },
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: {},
                    config,
                })
            },
        })
        await expect(request).rejects.toMatchObject({
            message: 'server failed',
            status: 500,
            code: 50000,
            traceId: 'trace-http',
        })
    })
})
