<script setup lang="ts">
import { usePostsStore } from '../stores/posts'
import PostItem from './PostItem.vue'

const store = usePostsStore()
</script>

<template>
  <section class="feed" aria-label="内容列表">
    <div class="post-list" aria-live="polite">
      <PostItem v-for="post in store.posts" :key="post.id" :post="post" />
    </div>

    <div v-if="store.isEmpty" class="empty-state">
      <div class="empty-icon" aria-hidden="true">✦</div>
      <p class="empty-title">还没有内容</p>
      <p class="empty-desc">写下第一条想法，开启你的记录之旅吧</p>
    </div>
  </section>
</template>
