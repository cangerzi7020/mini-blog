// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_LENGTH } from '../src/lib/constants'
import { EMPTY_ERROR } from '../src/lib/text'
import type { Post } from '../src/types'
import { createApp } from './app'
import { createPostStore, type PostStore } from './store'

interface PostsBody {
  posts: Post[]
}
interface PostBody {
  post: Post
}
interface ErrorBody {
  error: { code: string; message: string }
}

const INVALID_BODY_MESSAGE = '请求体必须是包含 content 字段的 JSON 对象'
const TOO_LONG_MESSAGE = `内容超出 ${MAX_LENGTH} 字上限`

const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T

/** 每次调用 +1s 的时钟 + 自增 id */
function seededStore(start = 1_000): PostStore {
  let time = start
  let seq = 0
  return createPostStore({ now: () => (time += 1_000), genId: () => `id-${++seq}` })
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

const client = (store: PostStore = seededStore()) => createApp({ store })

describe('GET /api/health', () => {
  it('返回 200、JSON Content-Type 与 ok 状态', async () => {
    const res = await client().request('/api/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(await readJson<{ status: string }>(res)).toEqual({ status: 'ok' })
  })
})

describe('GET /api/posts', () => {
  it('没有内容时返回空数组', async () => {
    const res = await client().request('/api/posts')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await readJson<PostsBody>(res)).toEqual({ posts: [] })
  })

  it('返回已发布内容且按发布时间倒序', async () => {
    const app = client()
    await app.request('/api/posts', jsonPost({ content: '第一条' }))
    await app.request('/api/posts', jsonPost({ content: '第二条' }))
    const { posts } = await readJson<PostsBody>(await app.request('/api/posts'))
    expect(posts.map((p) => p.content)).toEqual(['第二条', '第一条'])
    expect(posts[0]?.createdAt).toBeGreaterThan(posts[1]?.createdAt ?? 0)
  })
})

describe('POST /api/posts 成功', () => {
  it('返回 201 与创建后的 post，并写入存储', async () => {
    const store = seededStore()
    const app = createApp({ store })
    const res = await app.request('/api/posts', jsonPost({ content: '橘生淮南' }))

    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toContain('application/json')

    const { post } = await readJson<PostBody>(res)
    expect(post).toEqual({
      id: 'id-1',
      content: '橘生淮南',
      createdAt: 2_000,
      likes: 0,
      liked: false,
      bookmarked: false
    })
    expect(store.list()).toEqual([post])
    expect((await readJson<PostsBody>(await app.request('/api/posts'))).posts).toEqual([post])
  })

  it('设置指向新资源的 Location 头', async () => {
    const res = await client().request('/api/posts', jsonPost({ content: 'hi' }))
    expect(res.headers.get('location')).toBe('/api/posts/id-1')
  })

  it('保存 trim 后的内容', async () => {
    const store = seededStore()
    const res = await createApp({ store }).request(
      '/api/posts',
      jsonPost({ content: '  前后有空格  ' })
    )
    expect((await readJson<PostBody>(res)).post.content).toBe('前后有空格')
    expect(store.list()[0]?.content).toBe('前后有空格')
  })

  it('createdAt 相同时后发布的排在前面', async () => {
    let seq = 0
    const store = createPostStore({ now: () => 1_000, genId: () => `id-${++seq}` })
    const app = createApp({ store })
    await app.request('/api/posts', jsonPost({ content: '先发' }))
    await app.request('/api/posts', jsonPost({ content: '后发' }))
    const { posts } = await readJson<PostsBody>(await app.request('/api/posts'))
    expect(posts.map((p) => p.content)).toEqual(['后发', '先发'])
  })

  it('恰好 140 个码点（emoji）仍可发布', async () => {
    const res = await client().request('/api/posts', jsonPost({ content: '🍊'.repeat(MAX_LENGTH) }))
    expect(res.status).toBe(201)
  })
})

describe('POST /api/posts 校验失败', () => {
  it('空白内容返回 400 EMPTY_CONTENT', async () => {
    const res = await client().request('/api/posts', jsonPost({ content: '   \n\t ' }))
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'EMPTY_CONTENT', message: EMPTY_ERROR }
    })
  })

  it('超过 140 个码点返回 400 CONTENT_TOO_LONG', async () => {
    const res = await client().request(
      '/api/posts',
      jsonPost({ content: '字'.repeat(MAX_LENGTH + 1) })
    )
    expect(res.status).toBe(400)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'CONTENT_TOO_LONG', message: TOO_LONG_MESSAGE }
    })
  })

  it('content 不是字符串时返回 400 INVALID_BODY', async () => {
    const res = await client().request('/api/posts', jsonPost({ content: 42 }))
    expect(res.status).toBe(400)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'INVALID_BODY', message: INVALID_BODY_MESSAGE }
    })
  })

  it('缺少 content 字段时返回 400 INVALID_BODY', async () => {
    const res = await client().request('/api/posts', jsonPost({ title: '只有标题' }))
    expect(res.status).toBe(400)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'INVALID_BODY', message: INVALID_BODY_MESSAGE }
    })
  })

  it('body 不是对象时返回 400 INVALID_BODY', async () => {
    const res = await client().request('/api/posts', jsonPost(['内容']))
    expect(res.status).toBe(400)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'INVALID_BODY', message: INVALID_BODY_MESSAGE }
    })
  })

  it('超过 8KB 的请求体返回 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await client().request(
      '/api/posts',
      jsonPost({ content: '字'.repeat(4_000) })
    )
    expect(res.status).toBe(413)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' }
    })
  })

  it('body 不是合法 JSON 时返回 400 INVALID_BODY', async () => {
    const res = await client().request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{oops'
    })
    expect(res.status).toBe(400)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'INVALID_BODY', message: INVALID_BODY_MESSAGE }
    })
  })
})

describe('GET /api/posts/:id', () => {
  it('返回指定内容', async () => {
    const store = seededStore()
    const app = createApp({ store })
    const { post } = await readJson<PostBody>(
      await app.request('/api/posts', jsonPost({ content: '详情' }))
    )

    const res = await app.request(`/api/posts/${post.id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await readJson<PostBody>(res)).toEqual({ post })
  })

  it('id 不存在时返回 404 NOT_FOUND', async () => {
    const res = await client().request('/api/posts/missing')
    expect(res.status).toBe(404)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'NOT_FOUND', message: '内容不存在' }
    })
  })

  it('Location 头指向的地址可直接访问', async () => {
    const app = client()
    const created = await app.request('/api/posts', jsonPost({ content: '可寻址' }))
    const location = created.headers.get('location')
    expect(location).toBe('/api/posts/id-1')

    const res = await app.request(location ?? '')
    expect(res.status).toBe(200)
    expect((await readJson<PostBody>(res)).post.content).toBe('可寻址')
  })
})

/** 先发一条内容，返回可直接操作其子资源的 app 与 id */
async function appWithPost(): Promise<{ app: ReturnType<typeof createApp>; id: string }> {
  const app = client()
  const { post } = await readJson<PostBody>(
    await app.request('/api/posts', jsonPost({ content: '可互动的内容' }))
  )
  return { app, id: post.id }
}

describe('POST /api/posts/:id/like', () => {
  it('切换点赞并返回更新后的内容', async () => {
    const { app, id } = await appWithPost()

    const res = await app.request(`/api/posts/${id}/like`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await readJson<PostBody>(res)).toEqual({
      post: {
        id,
        content: '可互动的内容',
        createdAt: 2_000,
        likes: 1,
        liked: true,
        bookmarked: false
      }
    })
  })

  it('重复调用即取消点赞', async () => {
    const { app, id } = await appWithPost()

    await app.request(`/api/posts/${id}/like`, { method: 'POST' })
    const { post } = await readJson<PostBody>(
      await app.request(`/api/posts/${id}/like`, { method: 'POST' })
    )

    expect(post).toMatchObject({ likes: 0, liked: false })
  })

  it('点赞状态会出现在列表与详情接口中', async () => {
    const { app, id } = await appWithPost()
    await app.request(`/api/posts/${id}/like`, { method: 'POST' })

    const listed = await readJson<PostsBody>(await app.request('/api/posts'))
    const detail = await readJson<PostBody>(await app.request(`/api/posts/${id}`))

    expect(listed.posts[0]).toMatchObject({ likes: 1, liked: true })
    expect(detail.post).toMatchObject({ likes: 1, liked: true })
  })

  it('id 不存在时返回 404 NOT_FOUND', async () => {
    const res = await client().request('/api/posts/missing/like', { method: 'POST' })

    expect(res.status).toBe(404)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'NOT_FOUND', message: '内容不存在' }
    })
  })

  it('只改动目标内容', async () => {
    const app = client()
    await app.request('/api/posts', jsonPost({ content: '第一条' }))
    await app.request('/api/posts', jsonPost({ content: '第二条' }))

    await app.request('/api/posts/id-1/like', { method: 'POST' })

    const { posts } = await readJson<PostsBody>(await app.request('/api/posts'))
    expect(posts.find((post) => post.id === 'id-1')).toMatchObject({ liked: true, likes: 1 })
    expect(posts.find((post) => post.id === 'id-2')).toMatchObject({ liked: false, likes: 0 })
  })
})

describe('POST /api/posts/:id/bookmark', () => {
  it('切换收藏并返回更新后的内容', async () => {
    const { app, id } = await appWithPost()

    const res = await app.request(`/api/posts/${id}/bookmark`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(await readJson<PostBody>(res)).toEqual({
      post: {
        id,
        content: '可互动的内容',
        createdAt: 2_000,
        likes: 0,
        liked: false,
        bookmarked: true
      }
    })
  })

  it('重复调用即取消收藏', async () => {
    const { app, id } = await appWithPost()

    await app.request(`/api/posts/${id}/bookmark`, { method: 'POST' })
    const { post } = await readJson<PostBody>(
      await app.request(`/api/posts/${id}/bookmark`, { method: 'POST' })
    )

    expect(post.bookmarked).toBe(false)
  })

  it('收藏与点赞互不影响', async () => {
    const { app, id } = await appWithPost()

    await app.request(`/api/posts/${id}/bookmark`, { method: 'POST' })
    const { post } = await readJson<PostBody>(
      await app.request(`/api/posts/${id}/like`, { method: 'POST' })
    )

    expect(post).toMatchObject({ liked: true, likes: 1, bookmarked: true })
  })

  it('id 不存在时返回 404 NOT_FOUND', async () => {
    const res = await client().request('/api/posts/missing/bookmark', { method: 'POST' })

    expect(res.status).toBe(404)
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'NOT_FOUND', message: '内容不存在' }
    })
  })
})

describe('未知路由', () => {
  it('返回 404 NOT_FOUND', async () => {
    const res = await client().request('/api/nope')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await readJson<ErrorBody>(res)).toEqual({
      error: { code: 'NOT_FOUND', message: '接口不存在' }
    })
  })
})

describe('store 注入', () => {
  it('已存在的 store 数据会通过接口返回', async () => {
    const store = createPostStore({ now: () => 5, genId: () => 'seed' })
    store.add('预置内容')
    const { posts } = await readJson<PostsBody>(await createApp({ store }).request('/api/posts'))
    expect(posts).toEqual([
      {
        id: 'seed',
        content: '预置内容',
        createdAt: 5,
        likes: 0,
        liked: false,
        bookmarked: false
      }
    ])
  })

  it('不同 app 实例之间互不影响', async () => {
    const a = createApp({ store: seededStore() })
    const b = createApp({ store: seededStore() })
    await a.request('/api/posts', jsonPost({ content: '只在 A' }))
    expect((await readJson<PostsBody>(await b.request('/api/posts'))).posts).toEqual([])
  })
})
