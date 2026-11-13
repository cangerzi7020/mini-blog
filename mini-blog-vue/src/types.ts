/** 服务端返回的一条记录 */
export interface Post {
  /** 唯一标识，格式见 lib/uid.ts */
  id: string
  /** 正文，已去除首尾空白 */
  content: string
  /** 发布时间戳（毫秒） */
  createdAt: number
  /** 点赞数，非负整数 */
  likes: number
  /** 当前用户是否已点赞 */
  liked: boolean
  /** 当前用户是否已收藏 */
  bookmarked: boolean
}
