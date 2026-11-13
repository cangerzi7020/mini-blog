import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_ERROR, STORAGE_KEY } from '../lib/constants'
import { EMPTY_ERROR } from '../lib/text'
import type { Post } from '../types'
import { usePostsStore } from './posts'

const seed = (posts: Post[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))

const storedPosts = (): Post[] => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Post[]

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('初始状态与加载', () => {
  it('默认没有内容也不报错', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.isEmpty).toBe(true)
    expect(store.error).toBe('')
  })

  it('load 读入已存在的内容', () => {
    seed([{ id: 'a', content: '第一条想法', createdAt: 1 }])
    const store = usePostsStore()

    store.load()

    expect(store.posts).toEqual([{ id: 'a', content: '第一条想法', createdAt: 1 }])
    expect(store.isEmpty).toBe(false)
  })
})

describe('publish', () => {
  it('发布成功后写入存储并置顶', () => {
    seed([{ id: 'old', content: '旧内容', createdAt: 1 }])
    const store = usePostsStore()
    store.load()

    expect(store.publish('新内容')).toBe(true)

    expect(store.posts.map((post) => post.content)).toEqual(['新内容', '旧内容'])
    expect(storedPosts().map((post) => post.content)).toEqual(['新内容', '旧内容'])
    expect(store.error).toBe('')
  })

  it('保存的是去除首尾空白后的内容', () => {
    const store = usePostsStore()

    store.publish('  留白也是内容  ')

    expect(store.posts[0]?.content).toBe('留白也是内容')
  })

  it('为新内容生成唯一 id 与毫秒时间戳', () => {
    const store = usePostsStore()

    store.publish('第一条')
    store.publish('第二条')

    const ids = store.posts.map((post) => post.id)
    expect(new Set(ids).size).toBe(2)
    expect(store.posts.every((post) => post.createdAt > 0)).toBe(true)
  })

  it('空白内容被拒绝，不写入存储', () => {
    const store = usePostsStore()

    expect(store.publish('   ')).toBe(false)

    expect(store.error).toBe(EMPTY_ERROR)
    expect(store.posts).toEqual([])
    expect(storedPosts()).toEqual([])
  })

  it('超出长度上限被拒绝，不写入存储', () => {
    const store = usePostsStore()

    expect(store.publish('字'.repeat(141))).toBe(false)

    expect(store.error).toBe('内容超出 140 字上限')
    expect(storedPosts()).toEqual([])
  })

  it('存储写入失败时提示保存失败且不改动内存状态', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const store = usePostsStore()

    expect(store.publish('写不进去的内容')).toBe(false)

    expect(store.error).toBe(SAVE_ERROR)
    expect(store.posts).toEqual([])
  })

  it('重新发布成功后清除上一次的错误', () => {
    const store = usePostsStore()
    store.publish('   ')

    store.publish('这次可以')

    expect(store.error).toBe('')
  })
})

describe('排序与同步', () => {
  it('载入后即按发布时间倒序，不依赖存储顺序', () => {
    seed([
      { id: 'mid', content: '中间', createdAt: 2 },
      { id: 'old', content: '最早', createdAt: 1 },
      { id: 'new', content: '最新', createdAt: 3 }
    ])
    const store = usePostsStore()
    store.load()

    expect(store.posts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('syncFromStorage 反映其他标签页的写入', () => {
    const store = usePostsStore()
    store.load()

    seed([{ id: 'other', content: '别的标签页写的', createdAt: 9 }])
    store.syncFromStorage()

    expect(store.posts.map((post) => post.content)).toEqual(['别的标签页写的'])
  })

  it('clearError 重置错误文案', () => {
    const store = usePostsStore()
    store.publish('   ')

    store.clearError()

    expect(store.error).toBe('')
  })
})
