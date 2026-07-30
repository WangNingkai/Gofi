export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed'

export interface UploadTask {
    file: File
    progress: number
    status: UploadStatus
}

export function createUploadTasks(files: File[]): UploadTask[] {
    return files.map((file) => ({ file, progress: 0, status: 'pending' }))
}

export function updateUploadProgress(tasks: UploadTask[], fileName: string, progress: number): UploadTask[] {
    return tasks.map((task) => task.file.name === fileName
        ? { ...task, progress: Math.max(0, Math.min(progress, 100)), status: 'uploading' }
        : task)
}

export function settleUploadTasks(tasks: UploadTask[], status: 'completed' | 'failed'): UploadTask[] {
    return tasks.map((task) => ({ ...task, progress: 100, status }))
}

export function overallUploadProgress(tasks: UploadTask[]): number {
    if (tasks.length === 0) return 0
    return tasks.reduce((total, task) => total + task.progress, 0) / tasks.length
}
