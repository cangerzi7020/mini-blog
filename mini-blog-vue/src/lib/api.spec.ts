import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../types'
import { ApiError, createPost, fetchPosts } from './api'
import { EMPTY_ERROR } from './text'

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** 只带被测字段的响应替身，避免真实网络请求 */
const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as unknown as Response

/** 响应体不是 JSON 的替身 */
const textResponse = (status: number): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    }
  }) as unknown as Response

const stubFetch = (impl: FetchFn) => {
  const mock = vi.fn<FetchFn>(impl)
  vi.stubGlobal('fetch', mock)
  return mock
}

const post = (id: string, createdAt = 1, content = `第 ${id} 条`): Post => ({
  id,
  content,
  createdAt
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiError', () => {
  it('是 Error 子类并保留 code 与 message', () => {
    const error = new ApiError('EMPTY_CONTENT', EMPTY_ERROR)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.name).toBe('ApiError')
    expect(error.code).toBe('EMPTY_CONTENT')
    expect(error.message).toBe(EMPTY_ERROR)
  })
})

describe('fetchPosts', () => {
  it('成功时返回解析后的列表', async () => {
    stubFetch(async () => jsonResponse({ posts: [post('a', 2), post('b', 1)] }))

    await expect(fetchPosts()).resolves.toEqual([post('a', 2), post('b', 1)])
  })

  it('使用 GET 请求约定地址并接受 JSON', async () => {
    const mock = stubFetch(async () => jsonResponse({ posts: [] }))

    await fetchPosts()

    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith(
      '/api/posts',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
    )
  })

  it('丢弃 id/content/createdAt 不合法的脏条目', async () => {
    stubFetch(async () =>
      jsonResponse({
        posts: [
          post('keep', 5),
          { id: '', content: '无 id', createdAt: 1 },
          { id: 'b', content: '缺少时间' },
          { id: 3, content: 'id 类型错误', createdAt: 2 },
          { id: 'c', content: 4, createdAt: 3 },
          { id: 'd', content: '时间非数字', createdAt: '4' },
          { id: 'e', content: '时间非有限数', createdAt: Number.POSITIVE_INFINITY },
          null,
          'garbage'
        ]
      })
    )

    await expect(fetchPosts()).resolves.toEqual([post('keep', 5)])
  })

  it('响应缺少 posts 数组时抛 ApiError', async () => {
    stubFetch(async () => jsonResponse({ items: [] }))

    await expect(fetchPosts()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchPosts()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('响应体不是 JSON 时抛 ApiError', async () => {
    stubFetch(async () => textResponse(200))

    await expect(fetchPosts()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchPosts()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('非 2xx 时抛出带后端 message 的 ApiError', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'SERVER_ERROR', message: '服务器开小差了' } }, 500)
    )

    await expect(fetchPosts()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchPosts()).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      message: '服务器开小差了'
    })
  })

  it('非 2xx 且响应体无 error 结构时用状态码兜底', async () => {
    stubFetch(async () => jsonResponse({ message: 'not json shape' }, 502))

    await expect(fetchPosts()).rejects.toMatchObject({ code: 'HTTP_502' })
  })

  it('网络异常时抛 NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(fetchPosts()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchPosts()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('透传 AbortSignal', async () => {
    const controller = new AbortController()
    const mock = stubFetch(async () => jsonResponse({ posts: [] }))

    await fetchPosts(controller.signal)

    expect(mock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })

  it('请求被取消时原样抛出 AbortError', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    stubFetch(async () => {
      throw abortError
    })

    await expect(fetchPosts()).rejects.toBe(abortError)
  })
})

describe('createPost', () => {
  it('使用 POST 提交 JSON 内容', async () => {
    const mock = stubFetch(async () => jsonResponse({ post: post('new', 9) }, 201))

    await createPost('新内容')

    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ content: '新内容' })
    })
  })

  it('成功时返回后端生成的记录', async () => {
    stubFetch(async () => jsonResponse({ post: post('new', 9, '发布成功') }, 201))

    await expect(createPost('发布成功')).resolves.toEqual(post('new', 9, '发布成功'))
  })

  it('后端拒绝时抛出带 message 的 ApiError', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'EMPTY_CONTENT', message: EMPTY_ERROR } }, 400)
    )

    await expect(createPost('   ')).rejects.toBeInstanceOf(ApiError)
    await expect(createPost('   ')).rejects.toMatchObject({
      code: 'EMPTY_CONTENT',
      message: EMPTY_ERROR
    })
  })

  it('返回的 post 不合法时抛 ApiError', async () => {
    stubFetch(async () => jsonResponse({ post: { id: '', content: '缺 id', createdAt: 1 } }, 201))

    await expect(createPost('内容')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('网络异常时抛 NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(createPost('内容')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})
