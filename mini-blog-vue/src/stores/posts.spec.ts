import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPost, fetchPosts, toggleBookmark, toggleLike } from '../lib/api'
import { LOAD_ERROR, REACTION_ERROR, SAVE_ERROR } from '../lib/constants'
import { EMPTY_ERROR } from '../lib/text'
import type { Post } from '../types'
import { usePostsStore } from './posts'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    fetchPosts: vi.fn(),
    createPost: vi.fn(),
    toggleLike: vi.fn(),
    toggleBookmark: vi.fn()
  }
})

const mockedFetchPosts = vi.mocked(fetchPosts)
const mockedCreatePost = vi.mocked(createPost)
const mockedToggleLike = vi.mocked(toggleLike)
const mockedToggleBookmark = vi.mocked(toggleBookmark)

const post = (
  id: string,
  createdAt = 1,
  content = `第 ${id} 条`,
  extra: Partial<Post> = {}
): Post => ({
  id,
  content,
  createdAt,
  likes: 0,
  liked: false,
  bookmarked: false,
  ...extra
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
  mockedToggleLike.mockReset()
  mockedToggleBookmark.mockReset()
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

/** 先灌入一批内容，减少互动相关用例的重复准备 */
async function storeWith(posts: Post[]) {
  mockedFetchPosts.mockResolvedValue(posts)
  const store = usePostsStore()
  await store.load()
  return store
}

describe('点赞', () => {
  it('点击后立即在本地生效，并采用服务端返回的结果', async () => {
    const store = await storeWith([post('a', 1, '值得一赞')])
    const pending = deferred<Post>()
    mockedToggleLike.mockReturnValue(pending.promise)

    const done = store.toggleLike('a')

    expect(mockedToggleLike).toHaveBeenCalledWith('a')
    expect(store.posts[0]).toMatchObject({ liked: true, likes: 1 })
    expect(store.isPending('a', 'like')).toBe(true)

    pending.resolve(post('a', 1, '值得一赞', { liked: true, likes: 7 }))
    await done

    expect(store.posts[0]).toMatchObject({ liked: true, likes: 7 })
    expect(store.isPending('a', 'like')).toBe(false)
  })

  it('已点赞时再次点击取消，点赞数减一', async () => {
    const store = await storeWith([post('a', 1, '赞过', { likes: 3, liked: true })])
    mockedToggleLike.mockResolvedValue(post('a', 1, '赞过', { likes: 2, liked: false }))

    await store.toggleLike('a')

    expect(store.posts[0]).toMatchObject({ liked: false, likes: 2 })
  })

  it('请求失败时回滚本地状态并提示', async () => {
    const store = await storeWith([post('a', 1, '会失败')])
    mockedToggleLike.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))

    await store.toggleLike('a')

    expect(store.posts[0]).toMatchObject({ liked: false, likes: 0 })
    expect(store.actionError).toBe(REACTION_ERROR)
  })

  it('后端给出的失败原因直接展示', async () => {
    const store = await storeWith([post('a', 1, '不存在')])
    mockedToggleLike.mockRejectedValue(new ApiError('NOT_FOUND', '内容不存在'))

    await store.toggleLike('a')

    expect(store.actionError).toBe('内容不存在')
  })

  it('请求在途时忽略重复点击', async () => {
    const store = await storeWith([post('a', 1, '手速很快')])
    const pending = deferred<Post>()
    mockedToggleLike.mockReturnValue(pending.promise)

    void store.toggleLike('a')
    void store.toggleLike('a')

    expect(mockedToggleLike).toHaveBeenCalledTimes(1)
    expect(store.posts[0]).toMatchObject({ liked: true, likes: 1 })

    pending.resolve(post('a', 1, '手速很快', { liked: true, likes: 1 }))
  })

  it('操作成功会清空上一次的互动错误', async () => {
    const store = await storeWith([post('a', 1, '再来一次')])
    mockedToggleLike.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '网络异常'))
    mockedToggleLike.mockResolvedValueOnce(post('a', 1, '再来一次', { liked: true, likes: 1 }))

    await store.toggleLike('a')
    expect(store.actionError).toBe(REACTION_ERROR)

    await store.toggleLike('a')
    expect(store.actionError).toBe('')
    expect(store.posts[0]).toMatchObject({ liked: true, likes: 1 })
  })

  it('目标内容已不在列表中时静默结束', async () => {
    const store = await storeWith([])

    await store.toggleLike('missing')

    expect(mockedToggleLike).not.toHaveBeenCalled()
  })

  it('晚到的点赞响应不会覆盖已确认的收藏状态', async () => {
    const store = await storeWith([post('a', 1, '交叉操作')])
    const pendingLike = deferred<Post>()
    mockedToggleLike.mockReturnValue(pendingLike.promise)
    mockedToggleBookmark.mockResolvedValue(post('a', 1, '交叉操作', { bookmarked: true }))

    const likeDone = store.toggleLike('a')
    await store.toggleBookmark('a')
    expect(store.posts[0]?.bookmarked).toBe(true)

    // 服务端处理点赞时读到的 bookmarked 仍是 false，属于过期快照
    pendingLike.resolve(post('a', 1, '交叉操作', { likes: 1, liked: true, bookmarked: false }))
    await likeDone

    expect(store.posts[0]).toMatchObject({ likes: 1, liked: true, bookmarked: true })
  })

  it('点赞失败回滚不会抹掉已确认的收藏', async () => {
    const store = await storeWith([post('a', 1, '失败回滚')])
    mockedToggleLike.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))
    mockedToggleBookmark.mockResolvedValue(post('a', 1, '失败回滚', { bookmarked: true }))

    await store.toggleBookmark('a')
    await store.toggleLike('a')

    expect(store.posts[0]).toMatchObject({ likes: 0, liked: false, bookmarked: true })
    expect(store.actionError).toBe(REACTION_ERROR)
  })

  it('刷新带回新值后，失败回滚不覆盖它', async () => {
    const store = await storeWith([post('a', 1, '刷新竞争')])
    let rejectLike!: (err: unknown) => void
    mockedToggleLike.mockReturnValue(
      new Promise<Post>((_, reject) => {
        rejectLike = reject
      })
    )

    const done = store.toggleLike('a')
    expect(store.posts[0]).toMatchObject({ likes: 1, liked: true })

    // 在途期间列表被刷新，服务端已有点赞记录
    mockedFetchPosts.mockResolvedValue([post('a', 1, '刷新竞争', { likes: 5, liked: true })])
    await store.load()

    rejectLike(new ApiError('NETWORK_ERROR', '网络异常'))
    await done

    expect(store.posts[0]).toMatchObject({ likes: 5, liked: true })
    expect(store.actionError).toBe(REACTION_ERROR)
  })
})

describe('收藏与筛选', () => {
  it('切换收藏不会改动点赞状态', async () => {
    const store = await storeWith([post('a', 1, '收藏它', { likes: 2, liked: true })])
    mockedToggleBookmark.mockResolvedValue(
      post('a', 1, '收藏它', { likes: 2, liked: true, bookmarked: true })
    )

    await store.toggleBookmark('a')

    expect(store.posts[0]).toMatchObject({ bookmarked: true, liked: true, likes: 2 })
  })

  it('收藏失败时回滚', async () => {
    const store = await storeWith([post('a', 1, '收藏失败')])
    mockedToggleBookmark.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))

    await store.toggleBookmark('a')

    expect(store.posts[0]?.bookmarked).toBe(false)
    expect(store.actionError).toBe(REACTION_ERROR)
  })

  it('默认展示全部内容，收藏视图只保留已收藏内容', async () => {
    const store = await storeWith([
      post('a', 3, '收藏的', { bookmarked: true }),
      post('b', 2, '没收藏'),
      post('c', 1, '也收藏了', { bookmarked: true })
    ])

    expect(store.filter).toBe('all')
    expect(store.visiblePosts.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(store.bookmarkCount).toBe(2)

    store.setFilter('bookmarked')

    expect(store.visiblePosts.map((item) => item.id)).toEqual(['a', 'c'])

    store.setFilter('all')
    expect(store.visiblePosts).toHaveLength(3)
  })

  it('筛选不影响原始数据与空列表判定', async () => {
    const store = await storeWith([post('a', 1, '未收藏')])
    store.setFilter('bookmarked')

    expect(store.visiblePosts).toEqual([])
    expect(store.isEmpty).toBe(false)
    expect(store.posts).toHaveLength(1)
  })

  it('clearActionError 重置互动错误', async () => {
    const store = await storeWith([post('a', 1, '清掉提示')])
    mockedToggleLike.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))
    await store.toggleLike('a')

    store.clearActionError()

    expect(store.actionError).toBe('')
  })
})
