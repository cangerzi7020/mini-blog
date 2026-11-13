import type { Post } from '../types'
import { STORAGE_KEY } from './constants'

/** localStorage 的最小接口，便于在测试中注入替身 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
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

/** 解析存储快照：非法数据回退为空数组，脏条目丢弃，结果按时间倒序 */
export function parsePosts(raw: string | null): Post[] {
  if (!raw) return []

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    // 非 JSON（例如被其他脚本写坏）时不让页面崩溃
    return []
  }

  if (!Array.isArray(data)) return []

  return data
    .map(toPost)
    .filter((post): post is Post => post !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** 访问 localStorage 本身也可能抛错（隐私模式），此处一并兜住 */
function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage

  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 读取全部内容，任何异常都退化为空列表 */
export function readPosts(storage?: StorageLike): Post[] {
  const target = resolveStorage(storage)
  if (!target) return []

  try {
    return parsePosts(target.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

/** 覆盖写入全部内容，返回是否成功 */
export function writePosts(posts: Post[], storage?: StorageLike): boolean {
  const target = resolveStorage(storage)
  if (!target) return false

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(posts))
    return true
  } catch {
    return false
  }
}
