import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages 以仓库根发布，本应用位于 mini-blog/mini-blog-vue/ 子目录
  base: '/mini-blog/mini-blog-vue/',
  plugins: [vue()],
  server: {
    // 监听所有网卡：只绑 127.0.0.1 时，用机器名 / 非回环地址访问会被拒绝
    host: true,
    port: 5173,
    // 开发预览常通过机器名或代理域名访问，放行任意 Host 头
    allowedHosts: true,
    // 开发期把接口请求转发到本地 Hono 服务，生产环境同源部署时由网关处理
    proxy: {
      '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts', 'server/**/*.spec.ts'],
    // 每个 worker 复用一个 jsdom 实例，同时保留文件级隔离：全套件从 31s 降到 18s 左右
    pool: 'vmThreads'
  }
})
