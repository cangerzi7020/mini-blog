const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * 相对时间文案：刚刚 / N 分钟前 / N 小时前 / 日期。
 * 只在渲染时计算一次，不设定时器刷新。
 *
 * @param ts 目标时间戳（毫秒）
 * @param now 当前时间戳，测试时可注入
 */
export function formatTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts

  if (diff < MINUTE) return '刚刚'

  const minutes = Math.floor(diff / MINUTE)
  if (diff < HOUR) return `${minutes} 分钟前`

  const hours = Math.floor(diff / HOUR)
  if (diff < DAY) return `${hours} 小时前`

  const date = new Date(ts)
  const monthDay = `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`

  // 跨年时补全年份，同年只显示月日与时刻
  if (date.getFullYear() !== new Date(now).getFullYear()) {
    return `${date.getFullYear()}年${monthDay}`
  }

  return `${monthDay} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
