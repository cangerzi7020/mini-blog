// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPost, fetchPosts } from '../src/lib/api'
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
})
