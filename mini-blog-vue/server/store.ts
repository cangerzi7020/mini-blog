import { uid } from '../src/lib/uid'
import type { Post } from '../src/types'

/** 内存版内容仓库，仅服务端使用 */
export interface PostStore {
  /** 返回全部内容副本，按 createdAt 倒序，同时间戳时后添加的在前 */
  list(): Post[]
  /** 按 id 查询单条内容，不存在时返回 undefined */
  get(id: string): Post | undefined
  /** 追加一条内容，返回创建后的记录 */
  add(content: string): Post
  /** 清空（供测试重置） */
  clear(): void
}

/**
 * 创建内存仓库。
 *
 * @param options.now   时间源，默认 Date.now
 * @param options.genId id 生成器，默认 uid
 */
export function createPostStore(
  options: { now?: () => number; genId?: () => string } = {}
): PostStore {
  const now = options.now ?? (() => Date.now())
  const genId = options.genId ?? (() => uid())

  /** 内部按「最新在前」存放，减少相同时间戳时的排序歧义 */
  const posts: Post[] = []

  return {
    list() {
      // 返回副本：调用方改动不会污染内部状态。
      // sort 稳定，故 createdAt 相同的元素保持「后添加的在前」
      return posts.map((post) => ({ ...post })).sort((a, b) => b.createdAt - a.createdAt)
    },

    get(id) {
      // 同样返回副本，语义与 list 一致
      const found = posts.find((post) => post.id === id)
      return found ? { ...found } : undefined
    },

    add(content) {
      const post: Post = { id: genId(), content: content.trim(), createdAt: now() }
      posts.unshift(post)
      return { ...post }
    },

    clear() {
      posts.length = 0
    }
  }
}
