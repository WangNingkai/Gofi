import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import InitGuard from '../src/router/InitGuard'
import { useConfiguration } from '../src/hook/configuration'

vi.mock('../src/hook/configuration', () => ({
    useConfiguration: vi.fn(),
}))

const useConfigurationMock = vi.mocked(useConfiguration)
const mountedRoots: Array<{ container: HTMLDivElement; root: Root }> = []

function CurrentPath() {
    const location = useLocation()
    return <span data-current-path>{location.pathname}</span>
}

async function renderAt(path: string) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mountedRoots.push({ container, root })

    await act(async () => {
        root.render(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route element={<InitGuard />}>
                        <Route element={<Outlet />}>
                            <Route path="/setup" element={<CurrentPath />} />
                            <Route path="/auth/login" element={<CurrentPath />} />
                            <Route path="/file/*" element={<CurrentPath />} />
                        </Route>
                    </Route>
                </Routes>
            </MemoryRouter>,
        )
    })

    return container.querySelector('[data-current-path]')?.textContent
}

beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(async () => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop()
        if (!mounted) continue
        await act(async () => mounted.root.unmount())
        mounted.container.remove()
    }
    sessionStorage.clear()
    vi.clearAllMocks()
})

describe('InitGuard', () => {
    it('未初始化时跳转到初始化页面', async () => {
        useConfigurationMock.mockReturnValue({
            isInitialized: false,
            isLoading: false,
            error: undefined,
        })

        expect(await renderAt('/file/')).toBe('/setup')
    })

    it('已初始化时从初始化页面跳转到登录页', async () => {
        useConfigurationMock.mockReturnValue({
            isInitialized: true,
            isLoading: false,
            error: undefined,
        })

        expect(await renderAt('/setup')).toBe('/auth/login')
    })

    it('刚完成初始化时允许停留在初始化页面', async () => {
        sessionStorage.setItem('justFinishedSetup', 'true')
        useConfigurationMock.mockReturnValue({
            isInitialized: true,
            isLoading: false,
            error: undefined,
        })

        expect(await renderAt('/setup')).toBe('/setup')
    })

    it('已初始化时保留正常文件路由', async () => {
        useConfigurationMock.mockReturnValue({
            isInitialized: true,
            isLoading: false,
            error: undefined,
        })

        expect(await renderAt('/file/docs')).toBe('/file/docs')
    })
})
