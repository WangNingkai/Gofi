import { describe, expect, it } from 'vitest'
import {
    createUploadTasks,
    overallUploadProgress,
    settleUploadTasks,
    updateUploadProgress,
} from '../src/features/upload/task'

function file(name: string): File {
    return new File(['content'], name)
}

describe('上传任务模型', () => {
    it('独立记录每个文件进度并计算总体进度', () => {
        const tasks = updateUploadProgress(
            createUploadTasks([file('a.txt'), file('b.txt')]),
            'a.txt',
            50,
        )

        expect(tasks[0]).toMatchObject({ progress: 50, status: 'uploading' })
        expect(tasks[1]).toMatchObject({ progress: 0, status: 'pending' })
        expect(overallUploadProgress(tasks)).toBe(25)
    })

    it('限制非法进度并统一标记最终状态', () => {
        const tasks = updateUploadProgress(createUploadTasks([file('a.txt')]), 'a.txt', 120)
        expect(tasks[0].progress).toBe(100)
        expect(settleUploadTasks(tasks, 'failed')[0]).toMatchObject({
            progress: 100,
            status: 'failed',
        })
    })
})
