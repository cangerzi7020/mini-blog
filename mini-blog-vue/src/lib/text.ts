import { MAX_LENGTH } from './constants'

/** 空白内容提示文案 */
export const EMPTY_ERROR = '内容不能为空，写点什么再发布吧'

/** 按 Unicode 码点计数：emoji 等代理对字符只算 1 个 */
export function countChars(value: string): number {
  return Array.from(value).length
}

/** 是否为空内容（含纯空白） */
export function isBlank(value: string): boolean {
  return value.trim().length === 0
}

/**
 * 校验待发布内容，返回错误文案；通过则返回 null。
 * 首尾空白不参与长度计算，与发布时 trim 的口径一致。
 */
export function validateContent(raw: string): string | null {
  if (isBlank(raw)) return EMPTY_ERROR

  if (countChars(raw.trim()) > MAX_LENGTH) {
    return `内容超出 ${MAX_LENGTH} 字上限`
  }

  return null
}
