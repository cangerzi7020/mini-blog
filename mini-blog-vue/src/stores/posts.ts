import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, createPost, fetchPosts } from '../lib/api'
import { LOAD_ERROR, SAVE_ERROR } from '../lib/constants'
import { validateContent } from '../lib/text'
import type { Post } from '../types'

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
  /** 是否正在拉取列表 */
  const loading = ref(false)

  /** 在途的列表请求：新加载抢占旧加载，发布成功时作废旧快照 */
  let inFlight: AbortController | null = null

  const isEmpty = computed(() => posts.value.length === 0)

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
    error,
    loadError,
    loading,
    isEmpty,
    load,
    publish,
    clearError
  }
})
