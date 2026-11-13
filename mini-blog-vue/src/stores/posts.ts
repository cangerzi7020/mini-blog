import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  ApiError,
  createPost,
  fetchPosts,
  toggleBookmark as requestToggleBookmark,
  toggleLike as requestToggleLike
} from '../lib/api'
import { LOAD_ERROR, REACTION_ERROR, SAVE_ERROR } from '../lib/constants'
import { validateContent } from '../lib/text'
import type { Post } from '../types'

/** 列表筛选：全部 / 仅收藏 */
export type FeedFilter = 'all' | 'bookmarked'

/** 互动类型，用于区分同一条内容上互不阻塞的两个操作 */
type ReactionKind = 'like' | 'bookmark'

/** 后端给出了具体原因就用它，网络类错误回退到通用文案 */
function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code !== 'NETWORK_ERROR' && err.message !== '') {
    return err.message
  }
  return fallback
}

export const usePostsStore = defineStore('posts', () => {
  /** 内存中的内容，始终按发布时间倒序（最新在最前） */
  const posts = ref<Post[]>([])
  /** 发布相关的错误提示，空串表示无错误 */
  const error = ref('')
  /** 列表加载的错误提示，空串表示无错误 */
  const loadError = ref('')
  /** 点赞/收藏失败的提示，空串表示无错误 */
  const actionError = ref('')
  /** 是否正在拉取列表 */
  const loading = ref(false)
  /** 当前筛选条件，只影响展示，不改变数据 */
  const filter = ref<FeedFilter>('all')
  /** 在途的互动请求，键为 `${id}:${kind}`，避免重复点击造成状态错乱 */
  const pending = ref<Set<string>>(new Set())

  /** 在途的列表请求：新加载抢占旧加载，发布成功时作废旧快照 */
  let inFlight: AbortController | null = null

  const isEmpty = computed(() => posts.value.length === 0)

  /** 按当前筛选展示的内容 */
  const visiblePosts = computed(() =>
    filter.value === 'all'
      ? posts.value
      : posts.value.filter((post) => post.bookmarked)
  )

  /** 已收藏数量，供筛选标签与空状态使用 */
  const bookmarkCount = computed(
    () => posts.value.filter((post) => post.bookmarked).length
  )

  /** 该内容是否有指定类型的互动请求在途 */
  function isPending(id: string, kind: ReactionKind): boolean {
    return pending.value.has(`${id}:${kind}`)
  }

  /** 切换筛选条件 */
  function setFilter(next: FeedFilter): void {
    filter.value = next
  }

  /** 从服务端拉取列表；失败时保留已有内容，只提示错误 */
  async function load(): Promise<void> {
    inFlight?.abort()
    const current = new AbortController()
    inFlight = current

    loading.value = true
    loadError.value = ''

    try {
      const list = await fetchPosts(current.signal)
      // 已被更新的加载或发布抢占：丢弃这份过期快照
      if (inFlight !== current) return
      posts.value = list
    } catch (err) {
      if (inFlight !== current) return
      loadError.value = messageOf(err, LOAD_ERROR)
    } finally {
      if (inFlight === current) loading.value = false
    }
  }

  function clearError(): void {
    error.value = ''
  }

  /** 关掉互动错误提示（切换筛选或重新操作时调用） */
  function clearActionError(): void {
    actionError.value = ''
  }

  /**
   * 点赞/收藏的乐观更新：
   * 先改本地让反馈即时，成功后用服务端结果校正，失败则回滚并提示。
   */
  async function runReaction(
    id: string,
    kind: ReactionKind,
    request: (postId: string) => Promise<Post>
  ): Promise<void> {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return
    // 同一操作在途时忽略重复点击；点赞与收藏互不阻塞
    if (isPending(id, kind)) return

    const snapshot: Post = { ...post }
    pending.value.add(`${id}:${kind}`)
    actionError.value = ''

    if (kind === 'like') {
      post.liked = !post.liked
      post.likes = Math.max(0, post.likes + (post.liked ? 1 : -1))
    } else {
      post.bookmarked = !post.bookmarked
    }

    try {
      const updated = await request(id)
      // 列表可能已被刷新替换，找不到就丢弃这次结果
      const current = posts.value.find((item) => item.id === id)
      if (current) Object.assign(current, updated)
    } catch (err) {
      const current = posts.value.find((item) => item.id === id)
      if (current) {
        current.likes = snapshot.likes
        current.liked = snapshot.liked
        current.bookmarked = snapshot.bookmarked
      }
      actionError.value = messageOf(err, REACTION_ERROR)
    } finally {
      pending.value.delete(`${id}:${kind}`)
    }
  }

  /** 切换某条内容的点赞状态 */
  function toggleLike(id: string): Promise<void> {
    return runReaction(id, 'like', requestToggleLike)
  }

  /** 切换某条内容的收藏状态 */
  function toggleBookmark(id: string): Promise<void> {
    return runReaction(id, 'bookmark', requestToggleBookmark)
  }

  /**
   * 先本地校验，再提交到服务端。
   * 任何失败都只设置 error 并返回 false，由视图层保留用户输入。
   */
  async function publish(raw: string): Promise<boolean> {
    const message = validateContent(raw)
    if (message) {
      error.value = message
      return false
    }

    try {
      const post = await createPost(raw.trim())
      // 在途的列表请求可能是发布前的快照，直接作废，避免覆盖刚插入的内容
      inFlight?.abort()
      inFlight = null
      loading.value = false
      posts.value = [post, ...posts.value]
      error.value = ''
      loadError.value = ''
      return true
    } catch (err) {
      error.value = messageOf(err, SAVE_ERROR)
      return false
    }
  }

  return {
    posts,
    filter,
    visiblePosts,
    bookmarkCount,
    error,
    loadError,
    actionError,
    loading,
    isEmpty,
    isPending,
    load,
    publish,
    toggleLike,
    toggleBookmark,
    setFilter,
    clearError,
    clearActionError
  }
})
