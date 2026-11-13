import { describe, expect, it } from 'vitest'
import { MAX_LENGTH } from './constants'
import { countChars, isBlank, validateContent } from './text'

describe('countChars', () => {
  it('空字符串计为 0', () => {
    expect(countChars('')).toBe(0)
  })

  it('中文按字计数', () => {
    expect(countChars('橘生淮南')).toBe(4)
  })

  it('emoji 代理对只算 1 个字符', () => {
    expect(countChars('🍊')).toBe(1)
  })

  it('中英文与 emoji 混合时按码点计数', () => {
    expect(countChars('橘🍊ab')).toBe(4)
  })
})

describe('isBlank', () => {
  it('空串与纯空白视为空白', () => {
    expect(isBlank('')).toBe(true)
    expect(isBlank('   \n\t ')).toBe(true)
  })

  it('含可见字符时不为空白', () => {
    expect(isBlank('  hi ')).toBe(false)
  })
})

describe('validateContent', () => {
  it('纯空白内容返回空内容提示', () => {
    expect(validateContent('   ')).toBe('内容不能为空，写点什么再发布吧')
  })

  it('恰好达到上限时通过', () => {
    expect(validateContent('字'.repeat(MAX_LENGTH))).toBeNull()
  })

  it('超出上限一个字时返回超限提示', () => {
    expect(validateContent('字'.repeat(MAX_LENGTH + 1))).toBe(`内容超出 ${MAX_LENGTH} 字上限`)
  })

  it('按码点统计上限，140 个 emoji 仍通过', () => {
    expect(validateContent('🍊'.repeat(MAX_LENGTH))).toBeNull()
  })

  it('首尾空白不计入长度', () => {
    expect(validateContent(`  ${'字'.repeat(MAX_LENGTH)}  `)).toBeNull()
  })
})
