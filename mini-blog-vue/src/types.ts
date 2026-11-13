/** 一条本地记录 */
export interface Post {
  /** 唯一标识，格式见 lib/uid.ts */
  id: string
  /** 正文，已去除首尾空白 */
  content: string
  /** 发布时间戳（毫秒） */
  createdAt: number
}
