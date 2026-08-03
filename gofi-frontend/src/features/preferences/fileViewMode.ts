import { atom } from 'jotai'
import { FILE_VIEW_MODE } from '@/constants/storage'

export type FileViewMode = 'grid' | 'list'

export function readFileViewMode(storage: Pick<Storage, 'getItem'> = window.localStorage): FileViewMode {
    const stored = storage.getItem(FILE_VIEW_MODE)
    return stored === 'grid' || stored === 'list' ? stored : 'list'
}

const baseFileViewModeState = atom<FileViewMode | null>(null)

export const fileViewModeState = atom(
    (get) => get(baseFileViewModeState) ?? readFileViewMode(),
    (_get, set, mode: FileViewMode) => {
        set(baseFileViewModeState, mode)
        window.localStorage.setItem(FILE_VIEW_MODE, mode)
    },
)
