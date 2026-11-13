const SUFFIX_SPACE = 36 ** 6

let lastBase = ''
let seq = 0

/**
 * 生成「36 进制时间戳-6 位随机后缀」形式的 id。
 * 同一毫秒内随机源相同时追加自增序号兜底，保证 id 唯一。
 *
 * @param now 时间戳，测试时可注入
 * @param random 随机源，测试时可注入
 */
export function uid(now: number = Date.now(), random: () => number = Math.random): string {
  const base = `${now.toString(36)}-${Math.floor(random() * SUFFIX_SPACE)
    .toString(36)
    .padStart(6, '0')}`

  if (base === lastBase) {
    seq += 1
    return `${base}-${seq}`
  }

  lastBase = base
  seq = 0
  return base
}
