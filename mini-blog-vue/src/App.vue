<script setup lang="ts">
import PostComposer from './components/PostComposer.vue'
import PostFeed from './components/PostFeed.vue'
import { usePostsStore } from './stores/posts'

// setup 阶段即发起拉取，首帧显示加载中，数据回来后自动渲染
void usePostsStore().load()
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <span class="brand-logo">
          <svg class="brand-logo-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <defs>
              <radialGradient id="orangeBody" cx="38%" cy="26%" r="78%">
                <stop offset="0%" stop-color="#FFC46B" />
                <stop offset="45%" stop-color="#F97316" />
                <stop offset="100%" stop-color="#C2410C" />
              </radialGradient>
              <linearGradient id="orangeLeaf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#4ADE80" />
                <stop offset="100%" stop-color="#15803D" />
              </linearGradient>
              <linearGradient id="orangeLeafLeft" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stop-color="#16A34A" />
                <stop offset="100%" stop-color="#6EE7A8" />
              </linearGradient>
              <clipPath id="orangeClip">
                <circle cx="24" cy="28" r="17" />
              </clipPath>
            </defs>
            <!-- 果身与明暗，裁剪在圆形内以保持饱满轮廓 -->
            <g clip-path="url(#orangeClip)">
              <circle cx="24" cy="28" r="17" fill="url(#orangeBody)" />
              <ellipse cx="29" cy="44" rx="17" ry="9" fill="#7C2D12" opacity="0.16" />
              <ellipse
                cx="18"
                cy="20"
                rx="7"
                ry="4.4"
                fill="#FFFFFF"
                opacity="0.6"
                transform="rotate(-28 18 20)"
              />
            </g>
            <!-- 短梗 -->
            <path
              d="M24 13.2c-.2-2.4.4-4.2 1.6-5.4"
              fill="none"
              stroke="#7C4A21"
              stroke-width="2.4"
              stroke-linecap="round"
            />
            <!-- 叶片 -->
            <path
              d="M25.4 9.8C27 5.4 30.8 2.8 35.6 2.6 36.4 6.8 33.6 11.6 28.2 12.6 26.6 12.9 25.2 11.6 25.4 9.8Z"
              fill="url(#orangeLeaf)"
            />
            <path
              d="M22.6 10.2C21.4 6.4 18 4 13.8 4.2 13.6 8.2 16.4 11.9 21 12.6 22.4 12.8 23 11.4 22.6 10.2Z"
              fill="url(#orangeLeafLeft)"
            />
          </svg>
        </span>
        <span class="brand-name">橘生淮南</span>
      </div>
      <p class="brand-slogan">记录此刻的想法</p>
    </div>
  </header>

  <main class="container">
    <PostComposer />
    <PostFeed />
  </main>

  <footer class="footer">
    <p>橘生淮南 · 一个极简的记录小站</p>
  </footer>
</template>
