import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { EMPTY_ERROR, isBlank, validateContent } from '../src/lib/text'
import { createPostStore, type PostStore } from './store'

/** 请求体形状不对时的统一文案 */
const INVALID_BODY_MESSAGE = '请求体必须是包含 content 字段的 JSON 对象'
/** 未匹配路由的统一文案 */
const NOT_FOUND_MESSAGE = '接口不存在'
/** 指定 id 的内容不存在时的文案 */
const POST_NOT_FOUND_MESSAGE = '内容不存在'

const fail = (code: string, message: string) => ({ error: { code, message } })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * 创建 HTTP 应用。
 * 不传 store 时新建一个进程内内存仓库；测试可注入隔离的 store。
 */
export function createApp(deps: { store?: PostStore } = {}): Hono {
  const store = deps.store ?? createPostStore()
  const app = new Hono()

  // 直连与跨端口开发都放行任意来源
  app.use('*', cors())

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/posts', (c) => c.json({ posts: store.list() }))

  // POST 返回的 Location 指向这里，保证「已创建」的资源可寻址
  app.get('/api/posts/:id', (c) => {
    const post = store.get(c.req.param('id'))
    if (!post) return c.json(fail('NOT_FOUND', POST_NOT_FOUND_MESSAGE), 404)

    return c.json({ post })
  })

  // 140 字正文远小于此上限；先挡大包，避免整包解析后才判超长
  const limitBody = bodyLimit({
    maxSize: 8 * 1024,
    onError: (c) => c.json(fail('PAYLOAD_TOO_LARGE', '请求体过大'), 413)
  })

  app.post('/api/posts', limitBody, async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      // 空 body、非 JSON 文本都会走到这里
      return c.json(fail('INVALID_BODY', INVALID_BODY_MESSAGE), 400)
    }

    if (!isRecord(body) || typeof body.content !== 'string') {
      return c.json(fail('INVALID_BODY', INVALID_BODY_MESSAGE), 400)
    }

    const { content } = body

    // 空白优先判空，避免把空内容误判成超限
    if (isBlank(content)) {
      return c.json(fail('EMPTY_CONTENT', EMPTY_ERROR), 400)
    }

    // 阈值与码点计数统一由 src/lib/text 提供，此处不重复实现
    const tooLong = validateContent(content)
    if (tooLong !== null) {
      return c.json(fail('CONTENT_TOO_LONG', tooLong), 400)
    }

    const post = store.add(content)
    c.header('Location', `/api/posts/${post.id}`)
    return c.json({ post }, 201)
  })

  app.notFound((c) => c.json(fail('NOT_FOUND', NOT_FOUND_MESSAGE), 404))

  return app
}
