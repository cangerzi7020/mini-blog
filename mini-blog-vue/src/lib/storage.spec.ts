import { describe, expect, it } from 'vitest'
import type { Post } from '../types'
import { STORAGE_KEY } from './constants'
import { parsePosts, readPosts, writePosts, type StorageLike } from './storage'

const makePost = (id: string, createdAt: number, content = `第 ${id} 条`): Post => ({
  id,
  content,
  createdAt
})

/** 模拟隐私模式 / 配额满：任何访问都抛错 */
const brokenStorage: StorageLike = {
  getItem() {
    throw new Error('storage disabled')
  },
  setItem() {
    throw new Error('quota exceeded')
  }
}

const memoryStorage = (initial?: string): StorageLike => {
  let value = initial ?? null
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next
    }
  }
}

describe('parsePosts', () => {
  it('空值返回空数组', () => {
    expect(parsePosts(null)).toEqual([])
    expect(parsePosts('')).toEqual([])
  })

  it('非法 JSON 返回空数组而不是抛错', () => {
    expect(parsePosts('{不是 json')).toEqual([])
  })

  it('顶层不是数组时返回空数组', () => {
    expect(parsePosts('{"content":"legacy"}')).toEqual([])
    expect(parsePosts('42')).toEqual([])
  })

  it('过滤字段缺失或类型错误的条目', () => {
    const raw = JSON.stringify([
      makePost('a', 1),
      { id: 'b', content: '缺少时间' },
      { id: 3, content: 'id 类型错误', createdAt: 2 },
      { id: 'c', content: 4, createdAt: 3 },
      { id: 'd', content: '时间非数字', createdAt: '4' },
      null,
      'garbage'
    ])

    expect(parsePosts(raw)).toEqual([makePost('a', 1)])
  })

  it('按 createdAt 倒序返回，不信任存储顺序', () => {
    const raw = JSON.stringify([makePost('old', 1), makePost('new', 3), makePost('mid', 2)])

    expect(parsePosts(raw).map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('id 为空的条目视为脏数据', () => {
    expect(parsePosts(JSON.stringify([{ id: '', content: '无 id', createdAt: 1 }]))).toEqual([])
  })
})

describe('readPosts', () => {
  it('没有历史数据时返回空数组', () => {
    expect(readPosts()).toEqual([])
  })

  it('读取已持久化的内容', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makePost('a', 1)]))

    expect(readPosts()).toEqual([makePost('a', 1)])
  })

  it('存储不可用时返回空数组，避免页面崩溃', () => {
    expect(readPosts(brokenStorage)).toEqual([])
  })
})

describe('writePosts', () => {
  it('写入成功后可从同一份存储读回', () => {
    const storage = memoryStorage()

    expect(writePosts([makePost('a', 1)], storage)).toBe(true)
    expect(readPosts(storage)).toEqual([makePost('a', 1)])
  })

  it('写入 localStorage 使用约定的 key', () => {
    writePosts([makePost('a', 1)])

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual([makePost('a', 1)])
  })

  it('存储不可用时返回 false 而不是抛错', () => {
    expect(writePosts([makePost('a', 1)], brokenStorage)).toBe(false)
  })
})
