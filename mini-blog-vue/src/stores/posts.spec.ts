import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPost, fetchPosts } from '../lib/api'
import { LOAD_ERROR, SAVE_ERROR } from '../lib/constants'
import { EMPTY_ERROR } from '../lib/text'
import type { Post } from '../types'
import { usePostsStore } from './posts'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, fetchPosts: vi.fn(), createPost: vi.fn() }
})

const mockedFetchPosts = vi.mocked(fetchPosts)
const mockedCreatePost = vi.mocked(createPost)

const post = (id: string, createdAt = 1, content = `第 ${id} 条`): Post => ({
  id,
  content,
  createdAt
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockedFetchPosts.mockReset()
  mockedCreatePost.mockReset()
})

describe('初始状态与加载', () => {
  it('默认没有内容、不加载也不报错', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.isEmpty).toBe(true)
    expect(store.error).toBe('')
    expect(store.loadError).toBe('')
    expect(store.loading).toBe(false)
  })

  it('load 成功后填充列表并清空加载错误', async () => {
    mockedFetchPosts.mockResolvedValue([post('new', 2), post('old', 1)])
    const store = usePostsStore()

    await store.load()

    expect(store.posts.map((item) => item.id)).toEqual(['new', 'old'])
    expect(store.isEmpty).toBe(false)
    expect(store.loadError).toBe('')
    expect(store.loading).toBe(false)
  })

  it('load 期间 loading 为 true，完成后复位', async () => {
    const pending = deferred<Post[]>()
    mockedFetchPosts.mockReturnValue(pending.promise)
    const store = usePostsStore()

    const done = store.load()
    expect(store.loading).toBe(true)

    pending.resolve([post('a', 1)])
    await done

    expect(store.loading).toBe(false)
    expect(store.posts.map((item) => item.id)).toEqual(['a'])
  })

  it('load 失败时设置 loadError 并保留已有列表', async () => {
    mockedFetchPosts.mockResolvedValueOnce([post('a', 1)])
    mockedFetchPosts.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '网络异常'))
    const store = usePostsStore()

    await store.load()
    await store.load()

    expect(store.posts.map((item) => item.id)).toEqual(['a'])
    expect(store.loadError).toBe(LOAD_ERROR)
    expect(store.loading).toBe(false)
  })

  it('load 再次成功后清空上一次的加载错误', async () => {
    mockedFetchPosts.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '网络异常'))
    mockedFetchPosts.mockResolvedValueOnce([post('b', 2)])
    const store = usePostsStore()

    await store.load()
    expect(store.loadError).toBe(LOAD_ERROR)

    await store.load()
    expect(store.loadError).toBe('')
  })

  it('发布期间返回的旧列表快照不会覆盖新内容', async () => {
    const pending = deferred<Post[]>()
    mockedFetchPosts.mockReturnValue(pending.promise)
    mockedCreatePost.mockResolvedValue(post('new', 9, '刚发的'))
    const store = usePostsStore()

    const loading = store.load()
    await store.publish('刚发的')

    pending.resolve([post('old', 1, '旧内容')])
    await loading

    expect(store.posts.map((item) => item.content)).toEqual(['刚发的'])
    expect(store.loading).toBe(false)
  })

  it('发布成功会清掉上一次的加载错误', async () => {
    mockedFetchPosts.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '网络异常'))
    mockedCreatePost.mockResolvedValue(post('new', 9, '新内容'))
    const store = usePostsStore()

    await store.load()
    expect(store.loadError).toBe(LOAD_ERROR)

    await store.publish('新内容')
    expect(store.loadError).toBe('')
  })

  it('空列表判定随加载结果变化', async () => {
    mockedFetchPosts.mockResolvedValue([])
    const store = usePostsStore()

    await store.load()
    expect(store.isEmpty).toBe(true)

    mockedFetchPosts.mockResolvedValueOnce([post('a', 1)])
    await store.load()
    expect(store.isEmpty).toBe(false)
  })
})

describe('publish', () => {
  it('空白内容被拒绝且不请求接口', async () => {
    const store = usePostsStore()

    await expect(store.publish('   ')).resolves.toBe(false)

    expect(store.error).toBe(EMPTY_ERROR)
    expect(store.posts).toEqual([])
    expect(mockedCreatePost).not.toHaveBeenCalled()
  })

  it('超出长度上限被拒绝且不请求接口', async () => {
    const store = usePostsStore()

    await expect(store.publish('字'.repeat(141))).resolves.toBe(false)

    expect(store.error).toBe('内容超出 140 字上限')
    expect(mockedCreatePost).not.toHaveBeenCalled()
  })

  it('发布成功把返回的记录置顶', async () => {
    mockedFetchPosts.mockResolvedValue([post('old', 1, '旧内容')])
    mockedCreatePost.mockResolvedValue(post('new', 9, '新内容'))
    const store = usePostsStore()
    await store.load()

    await expect(store.publish('新内容')).resolves.toBe(true)

    expect(store.posts.map((item) => item.content)).toEqual(['新内容', '旧内容'])
    expect(store.error).toBe('')
  })

  it('提交给接口的是去除首尾空白后的内容', async () => {
    mockedCreatePost.mockResolvedValue(post('new', 9, '留白也是内容'))
    const store = usePostsStore()

    await store.publish('  留白也是内容  ')

    expect(mockedCreatePost).toHaveBeenCalledWith('留白也是内容')
  })

  it('发布失败保留列表并返回 false', async () => {
    mockedFetchPosts.mockResolvedValue([post('old', 1, '旧内容')])
    mockedCreatePost.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))
    const store = usePostsStore()
    await store.load()

    await expect(store.publish('写不进去的内容')).resolves.toBe(false)

    expect(store.error).toBe(SAVE_ERROR)
    expect(store.posts.map((item) => item.content)).toEqual(['旧内容'])
  })

  it('后端返回的校验文案直接展示', async () => {
    mockedCreatePost.mockRejectedValue(new ApiError('EMPTY_CONTENT', EMPTY_ERROR))
    const store = usePostsStore()

    await expect(store.publish('内容')).resolves.toBe(false)

    expect(store.error).toBe(EMPTY_ERROR)
  })

  it('重新发布成功后清除上一次的错误', async () => {
    mockedCreatePost.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '网络异常'))
    mockedCreatePost.mockResolvedValueOnce(post('new', 9, '这次可以'))
    const store = usePostsStore()

    await store.publish('先失败一次')
    expect(store.error).toBe(SAVE_ERROR)

    await store.publish('这次可以')
    expect(store.error).toBe('')
  })

  it('clearError 重置发布错误', async () => {
    const store = usePostsStore()
    await store.publish('   ')

    store.clearError()

    expect(store.error).toBe('')
  })
})
