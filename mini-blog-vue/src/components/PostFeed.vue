<script setup lang="ts">
import { computed } from 'vue'
import { usePostsStore } from '../stores/posts'
import type { FeedFilter } from '../stores/posts'
import PostItem from './PostItem.vue'

const store = usePostsStore()

// 首屏还没有数据时才显示加载提示，刷新已有列表时不打断阅读
const showLoading = computed(() => store.loading && store.posts.length === 0)
// 加载中或加载失败时都不显示空状态，避免「还没有内容」误导用户
const showEmpty = computed(
  () => store.visiblePosts.length === 0 && !store.loading && !store.loadError
)
// 有内容才值得展示筛选：空页面上两个标签都没有意义
const showTabs = computed(() => store.posts.length > 0)
const isBookmarkView = computed(() => store.filter === 'bookmarked')

const tabs = computed<{ value: FeedFilter; label: string; count: number }[]>(() => [
  { value: 'all', label: '全部', count: store.posts.length },
  { value: 'bookmarked', label: '收藏', count: store.bookmarkCount }
])

/** 切换筛选时清掉上一次的互动错误，避免旧提示滞留 */
function selectFilter(next: FeedFilter): void {
  store.setFilter(next)
  store.clearActionError()
}
</script>

<template>
  <section class="feed" aria-label="内容列表">
    <p v-if="showLoading" class="feed-loading">加载中…</p>
    <div v-else-if="store.loadError" class="feed-error" role="alert">
      <span>{{ store.loadError }}</span>
      <button class="feed-retry" type="button" @click="store.load()">重试</button>
    </div>

    <div v-if="showTabs" class="feed-tabs" aria-label="内容筛选">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="feed-tab"
        :class="{ active: store.filter === tab.value }"
        type="button"
        :aria-pressed="store.filter === tab.value"
        @click="selectFilter(tab.value)"
      >
        <span class="feed-tab-label">{{ tab.label }}</span>
        <span class="feed-tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <p v-if="store.actionError" class="feed-action-error" role="alert">
      {{ store.actionError }}
    </p>

    <div class="post-list" aria-live="polite">
      <PostItem v-for="post in store.visiblePosts" :key="post.id" :post="post" />
    </div>

    <div v-if="showEmpty" class="empty-state">
      <div class="empty-icon" aria-hidden="true">{{ isBookmarkView ? '☆' : '✦' }}</div>
      <p class="empty-title">{{ isBookmarkView ? '还没有收藏' : '还没有内容' }}</p>
      <p class="empty-desc">
        {{
          isBookmarkView
            ? '点亮卡片上的书签，把喜欢的想法收进这里'
            : '写下第一条想法，开启你的记录之旅吧'
        }}
      </p>
    </div>
  </section>
</template>
