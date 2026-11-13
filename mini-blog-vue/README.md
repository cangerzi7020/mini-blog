# 橘生淮南 · Vue 版

`mini-blog` 的 Vue 3 重写版：前端 **Vue 3 + Pinia**，后端是 **Node.js + Hono** 提供的 REST API，数据保存在服务端进程内存里。前后端都按 TDD 推进，140 字上限、码点计数、空内容判定只有一份实现，两侧共用。

数据不在浏览器里：刷新页面会重新向服务端拉取列表；API 进程重启则内存清空，内容不落盘、不做持久化。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 构建 | Vite 8 + TypeScript（`npm run build` 先跑类型检查再打包） |
| 视图 | Vue 3.5（`<script setup>` + TypeScript） |
| 状态 | Pinia 4（setup store） |
| 后端 | Hono 4 + `@hono/node-server`，`tsx` 直接运行 TS |
| 存储 | 服务端进程内存数组（无数据库、无文件读写） |
| 测试 | Vitest + jsdom + @vue/test-utils |
| 开发编排 | `concurrently` 同时拉起 API 与前端 |

## 运行

```bash
npm install

npm run dev          # 同时启动 API（8788）与前端（5173）
npm run dev:server   # 只起 API：tsx watch server/index.ts
npm run dev:web      # 只起前端：vite
npm run start:server # 非监听模式跑一次 API：tsx server/index.ts

npm run test         # vitest run，全量跑一遍
npm run test:watch   # vitest 监听模式
npm run typecheck    # vue-tsc --noEmit + tsc --noEmit（tsconfig.node.json 含 server/）
npm run build        # typecheck + vite build
npm run preview      # 预览构建产物，需另开 dev:server 才有接口
```

端口约定：API 默认 `8788`，可用环境变量覆盖，如 PowerShell 里 `$env:PORT=9000; npm run dev:server`；前端默认 `5173`，页面地址 `http://localhost:5173/mini-blog/mini-blog-vue/`。

`vite.config.ts` 的 `server.proxy` 把 `/api` 转发到 `http://127.0.0.1:8788`，因此前端代码里只出现相对路径 `/api/posts`，不写死主机名。`server.host` 为 `true`（监听所有网卡）、`allowedHosts` 为 `true`，用 `localhost`、机器名或局域网 IP 都能打开；只绑 `127.0.0.1` 时用机器名访问会「拒绝连接」。

`npm run preview` 只服务静态产物，`server.proxy` 不作用于 preview，接口请求会落空；要联调请用 `npm run dev`。

## 架构分层与目录

```
server/
├── index.ts                    # 启动入口：@hono/node-server，端口 8788（PORT 可覆盖）
├── app.ts                      # createApp({ store })：cors、8KB bodyLimit、路由、notFound
├── store.ts                    # createPostStore：进程内内存数组，list/get/add/toggleLike/toggleBookmark/clear
├── store.spec.ts               # 内存仓库单测
├── app.spec.ts                 # 路由、状态码与错误契约
└── contract.spec.ts            # 用真实 app 替换 fetch，验证前后端契约

src/
├── types.ts                    # Post 领域模型
├── lib/                        # 纯函数，不依赖 Vue，可直接单测
│   ├── api.ts                  # fetchPosts / createPost / toggleLike / toggleBookmark / ApiError
│   ├── constants.ts            # 140 上限、加载/保存/互动失败文案
│   ├── text.ts                 # 码点计数、空白判定、发布校验（前后端共用）
│   ├── time.ts                 # 相对时间文案
│   └── uid.ts                  # 时间戳-随机后缀 id
├── stores/posts.ts             # Pinia：列表、加载、发布、点赞/收藏、筛选与错误状态
├── components/
│   ├── PostComposer.vue        # 发布框：计数、禁用、快捷键、错误提示
│   ├── PostItem.vue            # 单条内容 + 点赞/收藏按钮
│   └── PostFeed.vue            # 筛选标签 + 列表 + 加载/失败/空状态
├── App.vue                     # 页面骨架，setup 阶段触发首次 load()
├── style.css                   # 从原生版迁移的主题与布局
└── main.ts                     # 挂载入口
```

依赖方向单向：`components → stores → lib/api →（HTTP）→ server/app → server/store`。

- `src/lib` 不知道 Vue 与 DOM 的存在，`server/store` 不知道 HTTP 的存在，只有 `server/app.ts` 处理请求校验与状态码。
- `src/lib/text.ts` 是前后端唯一的校验实现，`server/app.ts` 直接 import 它，因此长度上限、码点计数、空内容文案不会两侧分叉。
- 组件不直接 `fetch`，接口响应形状只在 `src/lib/api.ts` 收口。

## REST API 契约

服务默认监听 `8788`，全部路由挂在 `/api` 下；`cors()` 默认放行任意来源。

| 方法 | 路径 | 请求 | 成功响应 | 可能的错误码 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 无 | `200` `{ "status": "ok" }` | — |
| GET | `/api/posts` | 无 | `200` `{ "posts": Post[] }`，按 `createdAt` 倒序 | — |
| GET | `/api/posts/:id` | 路径参数 `id` | `200` `{ "post": Post }` | `NOT_FOUND`（`404`） |
| POST | `/api/posts` | `{ "content": string }`（JSON） | `201` `{ "post": Post }`，附 `Location: /api/posts/{id}` | `INVALID_BODY` / `EMPTY_CONTENT` / `CONTENT_TOO_LONG` / `PAYLOAD_TOO_LARGE` |
| POST | `/api/posts/:id/like` | 无 | `200` `{ "post": Post }`，切换点赞 | `NOT_FOUND`（`404`） |
| POST | `/api/posts/:id/bookmark` | 无 | `200` `{ "post": Post }`，切换收藏 | `NOT_FOUND`（`404`） |
| 任意 | 未匹配路由 | — | — | `NOT_FOUND`（`404`） |

POST 的处理顺序（决定了错误码的优先级）：

1. `bodyLimit` 先按 8KB 拦截请求体，超限直接 `413 PAYLOAD_TOO_LARGE`，不进入 JSON 解析。
2. 解析 JSON 失败（空 body、非 JSON 文本）或 body 不是对象、`content` 不是字符串 → `400 INVALID_BODY`。
3. `content` 全是空白 → `400 EMPTY_CONTENT`；先判空再判长度，避免空内容被误报超限。
4. 超出 140 个码点 → `400 CONTENT_TOO_LONG`。
5. 通过后由 store 追加：`content` 先 `trim()`，`id` 由 `src/lib/uid.ts` 生成，`createdAt` 取当前毫秒。

`GET /api/posts` 返回副本并已排序，调用方修改数组不会影响服务端状态；`createdAt` 相同的条目保持「后发布的在前」（依赖稳定排序）。`GET /api/posts/:id` 的返回同样是副本。

`like` 与 `bookmark` 是**切换**语义：同一条内容连点两次即回到初始状态，不需要客户端先判断当前状态再选 `PUT`/`DELETE`。两者无请求体，也不经过 `bodyLimit`；状态存在内容记录上，点赞与收藏互不影响。当前没有用户体系，因此 `liked` / `bookmarked` 是所有客户端共享的一份状态。

### curl 示例

Windows 下 PowerShell 5.1 的 `curl` 是 `Invoke-WebRequest` 的别名，请写 `curl.exe`。

```bash
curl.exe http://127.0.0.1:8788/api/health
# {"status":"ok"}

curl.exe http://127.0.0.1:8788/api/posts
# {"posts":[]}

curl.exe -i -X POST http://127.0.0.1:8788/api/posts \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"第一条想法\"}"
# HTTP/1.1 201 Created
# Location: /api/posts/m3k9x1-a7f2c1
# {"post":{"id":"m3k9x1-a7f2c1","content":"第一条想法","createdAt":1763000000000}}

curl.exe http://127.0.0.1:8788/api/posts/m3k9x1-a7f2c1
# {"post":{"id":"m3k9x1-a7f2c1","content":"第一条想法","createdAt":1763000000000}}

curl.exe -i -X POST http://127.0.0.1:8788/api/posts \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"   \"}"
# HTTP/1.1 400 Bad Request
# {"error":{"code":"EMPTY_CONTENT","message":"内容不能为空，写点什么再发布吧"}}

curl.exe http://127.0.0.1:8788/api/nope
# 404 {"error":{"code":"NOT_FOUND","message":"接口不存在"}}
```

## 错误码

所有错误响应共用同一形状，前端不用为每个接口写解析分支：

```json
{ "error": { "code": "EMPTY_CONTENT", "message": "内容不能为空，写点什么再发布吧" } }
```

### 服务端

| 状态码 | code | 触发条件 | message |
| --- | --- | --- | --- |
| 400 | `INVALID_BODY` | body 不是合法 JSON，或不是含字符串 `content` 的对象 | `请求体必须是包含 content 字段的 JSON 对象` |
| 400 | `EMPTY_CONTENT` | `content` 全是空白 | `内容不能为空，写点什么再发布吧` |
| 400 | `CONTENT_TOO_LONG` | `content` 去空白后超过 140 个码点 | `内容超出 140 字上限` |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过 8KB | `请求体过大` |
| 404 | `NOT_FOUND` | 路由不存在（`接口不存在`）或指定 id 的内容不存在（`内容不存在`） | 见括号 |

### 前端 `ApiError.code`

`src/lib/api.ts` 把失败统一收敛成 `ApiError`（`name` 为 `ApiError`，带 `code` 与可直接展示的 `message`）：

| code | 含义 |
| --- | --- |
| 后端错误码原样透传 | 后端给了 `error.code` 就照搬，`message` 直接展示给用户 |
| `NETWORK_ERROR` | fetch 本身失败（断网、服务没启动）：`网络异常：无法连接服务器。` |
| `INVALID_RESPONSE` | 响应体不是 JSON，或形状不符契约：`接口返回格式不正确，请确认 API 服务已启动。` |
| `HTTP_<status>` | 非 2xx 但响应体没有 `error` 结构时的兜底，例如 `HTTP_502`，文案沿用 `请求失败，请稍后重试。` |

被 `AbortController` 取消的请求按 `AbortError` 原样抛出，不算接口错误，也不写进任何错误状态。

store 只在 `NETWORK_ERROR` 时使用本地文案（`LOAD_ERROR` / `SAVE_ERROR`），其余情况一律展示后端 message。

## TDD 推进顺序

12 个测试文件、120 个用例，测试文件与被测模块同名同目录，由 `vite.config.ts` 的 `test.include` 收敛为 `src/**/*.spec.ts` 与 `server/**/*.spec.ts`。

| 顺序 | 测试文件 | 用例数 | 先锁定的行为 |
| --- | --- | --- | --- |
| 1 | `src/lib/text.spec.ts` | 11 | 按码点计数（emoji 算 1 个）、首尾空白不计数、空白判定、超限文案 |
| 2 | `src/lib/time.spec.ts` | 8 | 刚刚 / N 分钟前 / N 小时前 / 同年月日 / 跨年 |
| 3 | `src/lib/uid.spec.ts` | 5 | id 形状、同毫秒不重复 |
| 4 | `server/store.spec.ts` | 12 | 初始为空、注入时钟与 id 生成器、写入前 trim、倒序、同时间戳后加在前、`list`/`get` 返回副本、`get` 未命中、`clear` |
| 5 | `server/app.spec.ts` | 21 | 200/201/400/413/404 全状态码、`Location` 头指向可访问的资源、5 种错误码与文案、store 注入隔离 |
| 6 | `src/lib/api.spec.ts` | 16 | 请求方法与头、脏条目丢弃、`INVALID_RESPONSE`、`HTTP_<status>` 兜底、`NETWORK_ERROR`、AbortSignal 透传 |
| 7 | `server/contract.spec.ts` | 3 | 前后端契约：发布后可倒序读回、空白与超限两侧拿到同一 code / message |
| 8 | `src/stores/posts.spec.ts` | 16 | 加载中与失败状态、旧快照不覆盖新内容、本地校验不发请求、提交 trim 后的内容、错误清理 |
| 9 | `src/components/*.spec.ts` | 22 | 计数与禁用、Ctrl/Cmd + Enter、发布中禁用、错误展示、HTML 转义、加载/失败/空状态、倒序渲染 |
| 10 | `src/App.spec.ts` | 6 | 首屏自动拉取列表、组件装配 |

### 「先写测试锁定契约」的两个例子

- `server/contract.spec.ts` 不 mock 任何一侧：它把真实 Hono app 塞进全局 `fetch`（`vi.stubGlobal('fetch', (input, init) => app.request(String(input), init))`），再调用前端的 `createPost` / `fetchPosts`。断言的是「空白内容发布时，前端收到的 `code` 必须是 `EMPTY_CONTENT`、`message` 必须等于 `src/lib/text.ts` 的 `EMPTY_ERROR`」。任一侧改文案、改错误码、改字段名（`posts` / `post` / `error`），这条用例立刻变红，契约不会悄悄漂移。
- `server/app.spec.ts` 先写了「超过 8KB 的请求体返回 413」的用例，才有了中间件式的 `bodyLimit` 挂在 POST 前面，而不是等整包解析完再判超长；同一批用例里「空白内容优先于超长」也把校验顺序固定了下来。`Location` 的用例则先断言「头里的地址能直接 200 取回」，再给 store 补 `get`、给 app 补 `GET /api/posts/:id`，避免返回一个 404 的定位头。

## 数据模型

一条内容就是 `Post`（`src/types.ts`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | `src/lib/uid.ts` 生成：36 进制时间戳 + `-` + 6 位随机后缀；同毫秒内碰撞时追加自增序号 |
| `content` | `string` | 正文，服务端入库前已 `trim()` |
| `createdAt` | `number` | 发布时间戳（毫秒） |
| `likes` | `number` | 点赞数，非负整数，取消点赞时不会减到 0 以下 |
| `liked` | `boolean` | 是否已点赞 |
| `bookmarked` | `boolean` | 是否已收藏 |

```json
{
  "id": "m3k9x1-a7f2c1",
  "content": "第一条想法",
  "createdAt": 1763000000000,
  "likes": 3,
  "liked": true,
  "bookmarked": false
}
```

前端拿到响应后仍逐条收窄：`id` 必须是非空字符串、`content` 必须是字符串、`createdAt` 必须是有限数字，不合格的条目直接丢弃；整体形状不对则抛 `INVALID_RESPONSE`，页面不会白屏。互动字段更宽松：`likes` 缺失或非法回退为 `0`，`liked` / `bookmarked` 只认字面 `true`，因此旧版服务端返回的数据也能正常渲染。

## 与原生 mini-blog 的差异

原生版仍是单页静态实现，数据留在浏览器 `localStorage`（key `mini-blog-posts`）。

| 项 | 原生版本（localStorage） | Vue 版（REST API） |
| --- | --- | --- |
| 存储位置 | 浏览器 `localStorage` | 服务端进程内存 |
| 数据生命周期 | 清除站点数据才丢 | API 进程重启即丢 |
| 数据共享 | 同浏览器同源共享，换设备看不到 | 同服务端实例的所有客户端共享 |
| 读取方式 | 每次渲染重新读盘 | 首屏 `GET /api/posts`，之后走 Pinia 单一状态 |
| 多标签页 | 监听 `storage` 事件跨标签同步 | 无同步机制，刷新才对齐 |
| 校验位置 | 仅前端 | 前端预校验 + 服务端强校验，共用 `src/lib/text.ts` |
| 保存失败 | `alert()` 弹窗 | 发布框内联红字，输入内容保留 |
| 渲染 | 手动 `createElement` | 模板插值，正文 HTML 自动转义 |

功能对齐：140 字上限、码点计数、空内容禁用、`Ctrl/Cmd + Enter` 发布、新内容置顶、加载/失败/空状态、相对时间文案。

Vue 版额外提供**点赞**与**收藏**：按钮乐观更新（先改本地再等服务端校正），失败自动回滚并内联提示；列表顶部可在「全部 / 收藏」之间切换，收藏数量实时统计。

## 已知限制

- **内存存储**：无数据库、无文件落盘，`dev:server` 的 watch 重启或进程退出后内容全部丢失。
- **单实例**：多进程、多副本部署时各自持有一份数据，客户端看到的列表取决于连到哪个进程。
- **无鉴权**：任何能访问端口的人都能读和发；`cors()` 放行任意来源。
- **无删除、无编辑接口**：业务路由只有读列表、读单条、发布，以及点赞/收藏两个切换接口。
- **互动状态无归属**：没有用户体系，`liked` / `bookmarked` 是全局唯一的一份状态，换设备、换浏览器看到的是同一个人的点赞与收藏。
- **无分页**：`GET /api/posts` 一次返回全量，列表大了只能靠前端渲染扛。
- **相对时间不自动刷新**：`PostItem` 在渲染时算一次，页面停留久了不会自己走字。
- **无速率限制**：8KB 的 bodyLimit 只挡超大包，不挡高频提交。

## 部署注意事项

- 前端产物是纯静态文件，但取数走相对路径 `/api/posts`，因此**静态站点与 API 必须同源**，或由网关/反向代理把 `/api` 转到 Hono 服务。分域部署需要先改 `src/lib/api.ts` 的 `ENDPOINT` 并确认 `cors()` 配置。
- `vite.config.ts` 的 `base` 为 `/mini-blog/mini-blog-vue/`，对应仓库根目录发布 GitHub Pages 时的路径；改为独立仓库或根路径部署时需同步修改。GitHub Pages 只能托管静态资源，接口要另起服务并做同源代理，否则页面会显示「加载失败：无法连接服务器」。
- API 进程用 `npm run start:server` 常驻（`PORT` 指定端口），不要在生产用 `dev:server` 的 watch 模式。
- 反向代理需原样转发 `Content-Type` 与响应头；8KB 的 JSON 限制远小于常见的 1MB 默认 body 上限，一般不需要额外调整。
- 进程重启会清空数据，若不能接受，需要把 `server/store.ts` 换成带持久化的实现——接口层与前端无需改动。
