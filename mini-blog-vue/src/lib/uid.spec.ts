import { describe, expect, it } from 'vitest'
import { uid } from './uid'

const FIXED_NOW = 1_763_000_000_000

describe('uid', () => {
  it('形如「时间戳36进制-6位后缀」', () => {
    expect(uid(FIXED_NOW, () => 0.5)).toMatch(/^[0-9a-z]+-[0-9a-z]{6}(-\d+)?$/)
  })

  it('以 36 进制时间戳作为前缀，便于按时间粗略排序', () => {
    expect(uid(FIXED_NOW, () => 0.5).startsWith(FIXED_NOW.toString(36))).toBe(true)
  })

  it('同一毫秒内多次调用不重复', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uid(FIXED_NOW, () => 0.5)))
    expect(ids.size).toBe(50)
  })

  it('不同毫秒生成不同 id', () => {
    expect(uid(FIXED_NOW, () => 0.5)).not.toBe(uid(FIXED_NOW + 1, () => 0.5))
  })

  it('随机源不同时后缀不同', () => {
    expect(uid(FIXED_NOW, () => 0.1)).not.toBe(uid(FIXED_NOW + 1_000, () => 0.9))
  })
})
