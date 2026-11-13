import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { SAVE_ERROR } from '../lib/constants'
import { readPosts, writePosts } from '../lib/storage'
import { validateContent } from '../lib/text'
import { uid } from '../lib/uid'
import type { Post } from '../types'

export const usePostsStore = defineStore('posts', () => {
  /** 内存中的内容，始终按发布时间倒序（最新在最前） */
  const posts = ref<Post[]>([])
  /** 发布相关的错误提示，空串表示无错误 */
  const error = ref('')

  const isEmpty = computed(() => posts.value.length === 0)

  /** 从 localStorage 载入（页面初始化、其他标签页写入后） */
  function load(): void {
    posts.value = readPosts()
  }

  function syncFromStorage(): void {
    load()
  }

  function clearError(): void {
    error.value = ''
  }

  /**
   * 校验并发布内容。
   * 校验失败或写盘失败都只设置 error 并返回 false，由视图层保留用户输入。
   */
  function publish(raw: string): boolean {
    const message = validateContent(raw)
    if (message) {
      error.value = message
      return false
    }

    const post: Post = { id: uid(), content: raw.trim(), createdAt: Date.now() }
    const next = [post, ...posts.value]

    // 先写盘再改内存：写失败时列表与存储保持一致
    if (!writePosts(next)) {
      error.value = SAVE_ERROR
      return false
    }

    posts.value = next
    error.value = ''
    return true
  }

  return {
    posts,
    error,
    isEmpty,
    load,
    syncFromStorage,
    clearError,
    publish
  }
})
