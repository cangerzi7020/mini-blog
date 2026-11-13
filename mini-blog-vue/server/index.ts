import { serve } from '@hono/node-server'
import { createApp } from './app'

const app = createApp()
// 8787 常被 IDE 自带服务占用，默认用 8788；可用 PORT 覆盖
const port = Number(process.env.PORT ?? 8788)

// 不指定 hostname，保持所有网卡可访问
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[mini-blog] API 服务已启动：http://localhost:${info.port}`)
})
