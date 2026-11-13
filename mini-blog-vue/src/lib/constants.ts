/** 单条内容的最大长度，按 Unicode 码点计数 */
export const MAX_LENGTH = 140

/** 列表加载失败（网络不通或服务未启动）时的提示文案 */
export const LOAD_ERROR = '加载失败：无法连接服务器，请稍后重试。'

/** 发布失败（网络不通或服务未启动）时的提示文案 */
export const SAVE_ERROR = '保存失败：无法连接服务器，内容未被保存。'

/** 点赞/收藏失败且后端没给出原因时的兜底文案 */
export const REACTION_ERROR = '操作失败：无法连接服务器，请稍后重试。'
