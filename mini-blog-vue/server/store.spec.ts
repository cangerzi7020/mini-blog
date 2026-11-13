// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPostStore } from './store'

/** 每次调用 +1s 的时钟 + 自增 id，便于断言顺序 */
function countingDeps(start = 1_000) {
  let time = start
  let seq = 0
  return {
    now: () => (time += 1_000),
    genId: () => `id-${++seq}`
  }
}

describe('createPostStore', () => {
  it('初始列表为空', () => {
    expect(createPostStore().list()).toEqual([])
  })

  it('add 使用注入的时钟与 id 生成器', () => {
    const store = createPostStore({ now: () => 42, genId: () => 'fixed' })
    expect(store.add('橘子')).toEqual({ id: 'fixed', content: '橘子', createdAt: 42 })
  })

  it('add 返回的记录会出现在 list 中', () => {
    const store = createPostStore(countingDeps())
    const post = store.add('第一条')
    expect(store.list()).toEqual([post])
  })

  it('content 首尾空白在存储前被 trim', () => {
    const store = createPostStore(countingDeps())
    expect(store.add('  前后有空格 \n').content).toBe('前后有空格')
    expect(store.list()[0]?.content).toBe('前后有空格')
  })

  it('list 按 createdAt 倒序', () => {
    const store = createPostStore(countingDeps())
    store.add('最早')
    store.add('中间')
    store.add('最新')
    expect(store.list().map((p) => p.content)).toEqual(['最新', '中间', '最早'])
  })

  it('createdAt 相同时后添加的排在前面', () => {
    let seq = 0
    const store = createPostStore({ now: () => 7, genId: () => `id-${++seq}` })
    store.add('先发')
    store.add('后发')
    expect(store.list().map((p) => p.content)).toEqual(['后发', '先发'])
  })

  it('list 返回副本，外部修改不影响内部数据', () => {
    const store = createPostStore(countingDeps())
    store.add('原始')
    const snapshot = store.list()
    snapshot.push({ id: 'x', content: '外插', createdAt: 0 })
    const [first] = snapshot
    if (first) first.content = '被改'
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0]?.content).toBe('原始')
  })

  it('get 按 id 取回内容', () => {
    const store = createPostStore(countingDeps())
    const post = store.add('可被读取')
    expect(store.get(post.id)).toEqual(post)
  })

  it('get 未命中返回 undefined', () => {
    const store = createPostStore(countingDeps())
    store.add('存在的')
    expect(store.get('missing')).toBeUndefined()
  })

  it('get 返回副本，外部修改不影响内部数据', () => {
    const store = createPostStore(countingDeps())
    const post = store.add('原始')
    const found = store.get(post.id)
    if (found) found.content = '被改'
    expect(store.list()[0]?.content).toBe('原始')
  })

  it('clear 清空所有数据', () => {
    const store = createPostStore(countingDeps())
    store.add('一条')
    store.clear()
    expect(store.list()).toEqual([])
  })

  it('不传 options 时用默认时钟与 uid', () => {
    const post = createPostStore().add('默认依赖')
    expect(post.id).toMatch(/^[0-9a-z]+-[0-9a-z]{6}(-\d+)?$/)
    expect(Number.isFinite(post.createdAt)).toBe(true)
    expect(post.content).toBe('默认依赖')
  })
})
