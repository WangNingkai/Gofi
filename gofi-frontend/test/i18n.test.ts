import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en'
import zhHans from '../src/i18n/zh-Hans'

describe('前端翻译完整性', () => {
    it('中英文翻译键保持一致', () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(zhHans).sort())
    })
})
