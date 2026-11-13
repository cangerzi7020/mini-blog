<script setup lang="ts">
import { computed } from 'vue'
import { usePostsStore } from '../stores/posts'
import PostItem from './PostItem.vue'

const store = usePostsStore()

// 首屏还没有数据时才显示加载提示，刷新已有列表时不打断阅读
const showLoading = computed(() => store.loading && store.posts.length === 0)
// 加载中或加载失败时都不显示空状态，避免「还没有内容」误导用户
const showEmpty = computed(() => store.isEmpty && !store.loading && !store.loadError)
</script>

<template>
  <section class="feed" aria-label="内容列表">
    <p v-if="showLoading" class="feed-loading">加载中…</p>
    <div v-else-if="store.loadError" class="feed-error" role="alert">
      <span>{{ store.loadError }}</span>
      <button class="feed-retry" type="button" @click="store.load()">重试</button>
    </div>

    <div class="post-list" aria-live="polite">
      <PostItem v-for="post in store.posts" :key="post.id" :post="post" />
    </div>

    <div v-if="showEmpty" class="empty-state">
      <div class="empty-icon" aria-hidden="true">✦</div>
      <p class="empty-title">还没有内容</p>
      <p class="empty-desc">写下第一条想法，开启你的记录之旅吧</p>
    </div>
  </section>
</template>
