import type { Post } from '../types'

/** 接口地址：开发期由 vite 代理转发到 127.0.0.1:8788 */
const ENDPOINT = '/api/posts'

/** 后端没给出可展示文案时的兜底 */
const FALLBACK_MESSAGE = '请求失败，请稍后重试。'

/** 响应体不是 JSON，或形状不符合契约 */
const INVALID_RESPONSE = '接口返回格式不正确，请确认 API 服务已启动。'

/** 接口调用失败：code 区分原因，message 可直接展示给用户 */
export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 把未知形状的条目收窄为 Post，脏数据返回 null */
function toPost(value: unknown): Post | null {
  if (!isRecord(value)) return null

  const { id, content, createdAt } = value

  if (typeof id !== 'string' || id.trim() === '') return null
  if (typeof content !== 'string') return null
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null

  return { id, content, createdAt }
}

/** 被 AbortController 取消的请求不算接口错误，原样抛给调用方 */
const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

/** 网络层失败（断网、服务未启动）统一归为 NETWORK_ERROR */
function networkError(): ApiError {
  return new ApiError('NETWORK_ERROR', '网络异常：无法连接服务器。')
}

/** 尽量取出 body.error.message，取不到时用状态码兜底 */
async function toApiError(response: Response): Promise<ApiError> {
  const fallbackCode = `HTTP_${response.status}`

  try {
    const body: unknown = await response.json()
    if (isRecord(body) && isRecord(body.error)) {
      const { code, message } = body.error
      return new ApiError(
        typeof code === 'string' && code !== '' ? code : fallbackCode,
        typeof message === 'string' && message !== '' ? message : FALLBACK_MESSAGE
      )
    }
  } catch {
    // 响应体不是 JSON：走状态码兜底
  }

  return new ApiError(fallbackCode, FALLBACK_MESSAGE)
}

/** 统一的 fetch 包装：网络异常与取消分别处理 */
async function send(init: RequestInit): Promise<Response> {
  try {
    return await fetch(ENDPOINT, init)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw networkError()
  }
}

/** 读取 JSON 响应体，解析失败视为响应不合法 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ApiError('INVALID_RESPONSE', INVALID_RESPONSE)
  }
}

/**
 * 拉取全部内容。
 * 后端已按 createdAt 倒序返回，此处只校验形状并丢弃脏条目。
 */
export async function fetchPosts(signal?: AbortSignal): Promise<Post[]> {
  const response = await send({
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal
  })

  if (!response.ok) throw await toApiError(response)

  const body = await readJson(response)
  if (!isRecord(body) || !Array.isArray(body.posts)) {
    throw new ApiError('INVALID_RESPONSE', INVALID_RESPONSE)
  }

  return body.posts.map(toPost).filter((post): post is Post => post !== null)
}

/** 发布一条内容，返回后端生成的完整记录 */
export async function createPost(content: string): Promise<Post> {
  const response = await send({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ content })
  })

  if (!response.ok) throw await toApiError(response)

  const body = await readJson(response)
  const post = isRecord(body) ? toPost(body.post) : null
  if (!post) throw new ApiError('INVALID_RESPONSE', INVALID_RESPONSE)

  return post
}
