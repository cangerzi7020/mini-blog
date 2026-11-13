// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  createPost,
  fetchPosts,
  toggleBookmark,
  toggleLike
} from '../src/lib/api'
import { EMPTY_ERROR } from '../src/lib/text'
import type { Post } from '../src/types'
import { createApp } from './app'
import { createPostStore } from './store'

/** 把真实 Hono 应用当成 fetch 后端，验证前后端契约而不是各自的 mock */
function useRealApi(): Post[] {
  let time = 1_000
  let seq = 0
  const store = createPostStore({
    now: () => (time += 1_000),
    genId: () => `id-${++seq}`
  })
  const app = createApp({ store })

  // tsconfig.node.json 未引入 DOM lib，这里用 string | URL | Request 而非 RequestInfo
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
    app.request(String(input), init)
  )

  return store.list()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('前后端契约', () => {
  it('通过真实接口发布后能按倒序读回', async () => {
    useRealApi()

    await createPost('第一条')
    await createPost('第二条')

    const posts = await fetchPosts()
    expect(posts.map((post) => post.content)).toEqual(['第二条', '第一条'])
    expect(posts[0]?.createdAt).toBeGreaterThan(posts[1]?.createdAt ?? 0)
  })

  it('空白内容被后端拒绝，前端拿到同一份错误码与文案', async () => {
    useRealApi()

    const error = await createPost('   ').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'EMPTY_CONTENT', message: EMPTY_ERROR })
  })

  it('超出码点上限被后端拒绝', async () => {
    useRealApi()

    const error = await createPost('字'.repeat(141)).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'CONTENT_TOO_LONG' })
  })

  it('点赞与收藏经真实接口往返，并在列表中读回', async () => {
    useRealApi()

    const created = await createPost('值得一赞')
    expect(created).toMatchObject({ likes: 0, liked: false, bookmarked: false })

    const liked = await toggleLike(created.id)
    expect(liked).toMatchObject({ likes: 1, liked: true, bookmarked: false })

    const bookmarked = await toggleBookmark(created.id)
    expect(bookmarked).toMatchObject({ likes: 1, liked: true, bookmarked: true })

    const posts = await fetchPosts()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({
      id: created.id,
      likes: 1,
      liked: true,
      bookmarked: true
    })
  })

  it('取消点赞后计数回到 0', async () => {
    useRealApi()

    const created = await createPost('点两次')
    await toggleLike(created.id)
    const unliked = await toggleLike(created.id)

    expect(unliked).toMatchObject({ likes: 0, liked: false })
  })

  it('对不存在的内容操作时前后端错误码一致', async () => {
    useRealApi()

    const error = await toggleBookmark('missing').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NOT_FOUND', message: '内容不存在' })
  })
})
