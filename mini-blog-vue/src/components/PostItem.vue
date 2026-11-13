<script setup lang="ts">
import { computed } from 'vue'
import { formatTime } from '../lib/time'
import type { Post } from '../types'

const props = defineProps<{ post: Post }>()

// 相对时间在渲染时算一次，刷新页面即更新
const time = computed(() => formatTime(props.post.createdAt))
</script>

<template>
  <article class="post card">
    <div class="post-head">
      <span class="post-name">我</span>
      <span class="post-time">{{ time }}</span>
    </div>
    <!-- 插值渲染，正文中的标签会被转义为纯文本 -->
    <p class="post-content">{{ post.content }}</p>
  </article>
</template>
