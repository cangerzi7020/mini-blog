# MiniBlog

极简的本地记录小站：纯 HTML + CSS + JavaScript，零依赖、零构建，数据只保存在当前浏览器。

## 功能

- **发布**：多行输入，最多 140 字（按码点计数，emoji 算 1 个），实时字数提示，空内容或超限时发布按钮禁用，`Ctrl/Cmd + Enter` 快捷发布。
- **查看**：新内容置顶，按发布时间倒序，相对时间显示（刚刚 / N 分钟前 / N 小时前 / 日期）。
- **持久化**：内容写入 `localStorage`，刷新或重开页面仍在；多标签页之间自动同步。
- **降级**：存储不可用（隐私模式、配额满）时提示保存失败，输入内容不丢失。

## 运行

直接用浏览器打开 `index.html` 即可，无需安装任何依赖。

如需通过本地静态服务访问（例如验证 `localStorage` 在 `http://` 下的行为）：

```bash
cd mini-blog
python -m http.server 5173
```

然后访问 `http://localhost:5173/`。

## 数据结构

`localStorage` key：`mini-blog-posts`，值为数组：

```json
[
  {
    "id": "m3k9x1-a7f2c1",
    "content": "第一条想法",
    "createdAt": 1763000000000
  }
]
```

`id` 用于唯一标识，`createdAt` 为毫秒时间戳，渲染时按它倒序排列。改动数据结构需同步 `app.js` 中的 `loadPosts` / `renderPosts`，否则旧数据会显示异常。

## 文件

| 文件 | 职责 |
| --- | --- |
| `index.html` | 页面结构：品牌栏、发布卡片、内容流、空状态 |
| `style.css` | 主题变量、卡片布局、动画与窄屏适配 |
| `app.js` | 数据层（localStorage 读写）、渲染层、交互层 |

## 清空数据

浏览器开发者工具 → Application → Local Storage → 删除 `mini-blog-posts`，刷新页面即可。

## 关于 GitHub Pages

本仓库根目录为笔记库，应用位于 `mini-blog/` 子目录。若启用 Pages（分支 `main`、目录 `/`），线上地址为：

```
https://cangerzi7020.github.io/mini-blog/mini-blog/
```
