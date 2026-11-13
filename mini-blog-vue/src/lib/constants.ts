/** 单条内容的最大长度，按 Unicode 码点计数 */
export const MAX_LENGTH = 140

/** localStorage 的 key：沿用原生版本的历史标识，改名会导致已有内容丢失 */
export const STORAGE_KEY = 'mini-blog-posts'

/** 写入失败（隐私模式、配额满）时的提示文案 */
export const SAVE_ERROR = '保存失败：浏览器本地存储不可用或已满，内容未被保存。'
