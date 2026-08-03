import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LoadingStage } from '@/components/Loading'

const roots: Root[] = []

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

afterEach(async () => {
    vi.useRealTimers()
    while (roots.length > 0) await act(async () => roots.pop()?.unmount())
    document.body.innerHTML = ''
})

describe('delayed loading feedback', () => {
    it('does not flash for fast operations', async () => {
        vi.useFakeTimers()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        await act(async () => root.render(<LoadingStage active delay={180} minimumVisible={240} label="Loading files" />))
        await act(async () => vi.advanceTimersByTime(120))
        expect(container.querySelector('[role="status"]')).toBeNull()

        await act(async () => root.render(<LoadingStage active={false} delay={180} minimumVisible={240} label="Loading files" />))
        await act(async () => vi.advanceTimersByTime(500))
        expect(container.querySelector('[role="status"]')).toBeNull()
    })

    it('keeps visible feedback stable once a slow operation reveals it', async () => {
        vi.useFakeTimers()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        roots.push(root)

        await act(async () => root.render(<LoadingStage active delay={180} minimumVisible={240} label="Loading files" />))
        await act(async () => vi.advanceTimersByTime(180))
        expect(container.querySelector('[role="status"]')).not.toBeNull()

        await act(async () => root.render(<LoadingStage active={false} delay={180} minimumVisible={240} label="Loading files" />))
        await act(async () => vi.advanceTimersByTime(239))
        expect(container.querySelector('[role="status"]')).not.toBeNull()
        await act(async () => vi.advanceTimersByTime(1))
        expect(container.querySelector('[role="status"]')).toBeNull()
    })
})
