# 橘生淮南 · Vue 版

`mini-blog` 的 Vue 3 重写版：同样的功能与视觉，换成 **Node.js + Vue 3 + Pinia** 的工具链，并用 **TDD** 逐层推进。数据依旧只存在浏览器 `localStorage`，与原生版共用同一个 key，已有内容可直接读出来。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 构建 | Vite 8（Node.js 22） |
| 视图 | Vue 3.5（`<script setup>` + TypeScript） |
| 状态 | Pinia 4（setup store） |
| 测试 | Vitest + jsdom + @vue/test-utils |
| 存储 | `localStorage`（无后端） |

## 运行

```bash
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173/mini-blog/mini-blog-vue/
npm run test       # 跑一遍全部测试
npm run test:watch # 测试监听模式
npm run typecheck  # vue-tsc + tsc
npm run build      # 类型检查 + 生产构建
```

`vite.config.ts` 里 `server.host` 设为 `true`（监听所有网卡）、`allowedHosts` 设为 `true`，因此用 `localhost`、机器名或局域网 IP 都能打开。若只绑 `127.0.0.1`，用机器名访问会「拒绝连接」，IDE 预览面板也会打不开。

## 目录即分层

```
src/
├── types.ts                    # Post 领域模型
├── lib/                        # 纯函数，不依赖 Vue，可直接单测
│   ├── constants.ts            # 长度上限、存储 key、失败文案
│   ├── text.ts                 # 码点计数、空内容判断、发布校验
│   ├── time.ts                 # 相对时间文案
│   ├── uid.ts                  # 时间戳-随机后缀 id
│   └── storage.ts              # localStorage 读写、脏数据兜底
├── stores/posts.ts             # Pinia：列表状态、发布动作、错误状态
├── components/
│   ├── PostComposer.vue        # 发布框：计数、禁用、快捷键、错误提示
│   ├── PostItem.vue            # 单条内容
│   └── PostFeed.vue            # 列表 + 空状态
├── App.vue                     # 页面骨架、首屏载入、跨标签页同步
├── style.css                   # 从原生版迁移的主题与布局
└── main.ts                     # 挂载入口
```

依赖方向单向：`components → stores → lib`。`lib` 不知道 Vue 的存在，`stores` 不认识 DOM，组件不直接碰 `localStorage`。

## TDD 是怎么推进的

每一层都按「写测试 → 看它失败 → 最小实现 → 转绿 → 重构」走，测试文件与被测模块同名同目录：

| 顺序 | 测试 | 先锁定的行为 |
| --- | --- | --- |
| 1 | `lib/text.spec.ts` | 按码点计数（emoji 算 1 个）、空白判定、超限文案 |
| 2 | `lib/time.spec.ts` | 刚刚 / N 分钟前 / N 小时前 / 同年月日 / 跨年 |
| 3 | `lib/uid.spec.ts` | id 形状、同毫秒不重复 |
| 4 | `lib/storage.spec.ts` | 非法 JSON、非数组、脏条目过滤、写入失败返回 false |
| 5 | `stores/posts.spec.ts` | 发布置顶、落盘顺序、校验失败不改状态、写盘失败保留输入 |
| 6 | `components/*.spec.ts` | 计数与禁用、Ctrl/Cmd + Enter、错误展示、HTML 转义、倒序渲染 |
| 7 | `App.spec.ts` | 首屏载入、`storage` 事件跨标签同步、无关 key 不刷新 |

两处「测试先行」改变设计的例子：

- 存储解析先写了「脏数据只丢条目、不整体崩」的用例，于是 `parsePosts` 有了逐条收窄的校验，而不是直接 `JSON.parse`。
- 排序用例暴露了「存储顺序 ≠ 渲染顺序」，最终把排序收敛到 `storage` 解析环节，`store` 只维护一个始终倒序的列表，去掉了多余的 `sortedPosts` 计算属性。

## localStorage 数据结构

key 与原生版一致：`mini-blog-posts`（历史标识，改名会导致既有内容丢失）。

```json
[
  {
    "id": "m3k9x1-a7f2c1",
    "content": "第一条想法",
    "createdAt": 1763000000000
  }
]
```

读取时逐条校验：`id` 必须是非空字符串、`content` 必须是字符串、`createdAt` 必须是有限数字，不合格的条目直接丢弃；整体不是数组或不是 JSON 时退化为空列表，页面不会白屏。

## 与原生版的差异

| 项 | 原生版 | Vue 版 |
| --- | --- | --- |
| 保存失败 | `alert()` 弹窗 | 发布框内联红字提示，输入内容保留 |
| 渲染 | 手动 `createElement` | 模板插值，正文 HTML 自动转义 |
| 数据入口 | 每次渲染重新读盘 | Pinia 单一状态，写盘成功后才更新内存 |
| 相对时间 | 渲染时计算 | 同（不做定时刷新，保持最小实现） |

功能对齐：140 字上限、码点计数、空内容禁用、`Ctrl/Cmd + Enter` 发布、新内容置顶、空状态、跨标签页同步。

## 部署

`vite.config.ts` 里 `base` 设为 `/mini-blog/mini-blog-vue/`，对应仓库根目录发布 GitHub Pages 时的路径。若改为独立仓库或根路径部署，需同步修改该字段。
