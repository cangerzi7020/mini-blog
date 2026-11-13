<script setup lang="ts">
import { computed } from 'vue'
import { formatTime } from '../lib/time'
import { usePostsStore } from '../stores/posts'
import type { Post } from '../types'

const props = defineProps<{ post: Post }>()

const store = usePostsStore()

// 相对时间在渲染时算一次，刷新页面即更新
const time = computed(() => formatTime(props.post.createdAt))
const likePending = computed(() => store.isPending(props.post.id, 'like'))
const bookmarkPending = computed(() => store.isPending(props.post.id, 'bookmark'))
</script>

<template>
  <article class="post card">
    <div class="post-head">
      <span class="post-name">我</span>
      <span class="post-time">{{ time }}</span>
    </div>
    <!-- 插值渲染，正文中的标签会被转义为纯文本 -->
    <p class="post-content">{{ post.content }}</p>

    <div class="post-actions">
      <button
        class="action-btn like-btn"
        :class="{ active: post.liked }"
        type="button"
        :aria-pressed="post.liked"
        :aria-label="post.liked ? '取消点赞' : '点赞'"
        :disabled="likePending"
        @click="store.toggleLike(post.id)"
      >
        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 20.4c-.3 0-.6-.1-.8-.3C7.4 17 3.6 13.6 3.6 9.7 3.6 7 5.7 4.9 8.3 4.9c1.4 0 2.8.7 3.7 1.8.9-1.1 2.3-1.8 3.7-1.8 2.6 0 4.7 2.1 4.7 4.8 0 3.9-3.8 7.3-7.6 10.4-.2.2-.5.3-.8.3Z"
            fill="currentColor"
            :fill-opacity="post.liked ? 1 : 0"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
        <span class="like-count">{{ post.likes }}</span>
      </button>

      <button
        class="action-btn bookmark-btn"
        :class="{ active: post.bookmarked }"
        type="button"
        :aria-pressed="post.bookmarked"
        :aria-label="post.bookmarked ? '取消收藏' : '收藏'"
        :disabled="bookmarkPending"
        @click="store.toggleBookmark(post.id)"
      >
        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M7 4.8h10c.9 0 1.6.7 1.6 1.6v13.2c0 .6-.7 1-1.2.6L12 16.6l-5.4 3.6c-.5.4-1.2 0-1.2-.6V6.4c0-.9.7-1.6 1.6-1.6Z"
            fill="currentColor"
            :fill-opacity="post.bookmarked ? 1 : 0"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
        <span class="bookmark-label">{{ post.bookmarked ? '已收藏' : '收藏' }}</span>
      </button>
    </div>
  </article>
</template>
