import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatTime } from './time'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe('formatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const ago = (ms: number) => Date.now() - ms

  it('不足 1 分钟显示刚刚', () => {
    expect(formatTime(ago(59_000))).toBe('刚刚')
  })

  it('整 1 分钟显示 1 分钟前', () => {
    expect(formatTime(ago(MINUTE))).toBe('1 分钟前')
  })

  it('59 分钟仍按分钟显示', () => {
    expect(formatTime(ago(59 * MINUTE))).toBe('59 分钟前')
  })

  it('整 1 小时显示 1 小时前', () => {
    expect(formatTime(ago(HOUR))).toBe('1 小时前')
  })

  it('23 小时仍按小时显示', () => {
    expect(formatTime(ago(23 * HOUR))).toBe('23 小时前')
  })

  it('满 24 小时且同年显示月日与时刻', () => {
    expect(formatTime(ago(24 * HOUR))).toBe('11月12日 12:00')
  })

  it('月日与时刻补零', () => {
    expect(formatTime(new Date(2026, 0, 5, 9, 7).getTime())).toBe('01月05日 09:07')
  })

  it('跨年显示完整年月日', () => {
    expect(formatTime(new Date(2025, 11, 30, 8, 5).getTime())).toBe('2025年12月30日')
  })
})
