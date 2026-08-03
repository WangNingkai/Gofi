import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import { fileViewModeState, readFileViewMode } from '@/features/preferences/fileViewMode'
import { FILE_VIEW_MODE } from '@/constants/storage'

const storageWith = (value: string | null): Pick<Storage, 'getItem'> => ({
    getItem: () => value,
})

const storedValues = new Map<string, string>()
const browserStorage: Storage = {
    get length() { return storedValues.size },
    clear: () => storedValues.clear(),
    getItem: (key) => storedValues.get(key) ?? null,
    key: (index) => Array.from(storedValues.keys())[index] ?? null,
    removeItem: (key) => { storedValues.delete(key) },
    setItem: (key, value) => { storedValues.set(key, value) },
}

describe('file view mode preference', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: browserStorage })
        browserStorage.clear()
    })

    it('defaults to list view when no preference exists', () => {
        expect(readFileViewMode(storageWith(null))).toBe('list')
    })

    it.each(['list', 'grid'] as const)('restores the persisted %s view', (mode) => {
        expect(readFileViewMode(storageWith(mode))).toBe(mode)
    })

    it('falls back to list view for an invalid stored value', () => {
        expect(readFileViewMode(storageWith('invalid'))).toBe('list')
    })

    it('persists homepage view changes for the settings page and future visits', () => {
        const store = createStore()
        expect(store.get(fileViewModeState)).toBe('list')

        store.set(fileViewModeState, 'grid')

        expect(window.localStorage.getItem(FILE_VIEW_MODE)).toBe('grid')
        expect(store.get(fileViewModeState)).toBe('grid')
    })
})
