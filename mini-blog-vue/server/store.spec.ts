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
    expect(store.add('橘子')).toEqual({
      id: 'fixed',
      content: '橘子',
      createdAt: 42,
      likes: 0,
      liked: false,
      bookmarked: false
    })
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
    snapshot.push({
      id: 'x',
      content: '外插',
      createdAt: 0,
      likes: 0,
      liked: false,
      bookmarked: false
    })
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

describe('createPostStore 点赞', () => {
  it('新内容初始未点赞、点赞数为 0', () => {
    const store = createPostStore(countingDeps())
    const post = store.add('还没人点赞')

    expect(post.likes).toBe(0)
    expect(post.liked).toBe(false)
  })

  it('第一次切换后 liked 为 true 且点赞数 +1', () => {
    const store = createPostStore(countingDeps())
    const { id } = store.add('值得一赞')

    expect(store.toggleLike(id)).toMatchObject({ id, likes: 1, liked: true })
    expect(store.get(id)).toMatchObject({ likes: 1, liked: true })
    expect(store.list()[0]).toMatchObject({ likes: 1, liked: true })
  })

  it('再次切换取消点赞，点赞数回到 0', () => {
    const store = createPostStore(countingDeps())
    const { id } = store.add('点错了')

    store.toggleLike(id)
    expect(store.toggleLike(id)).toMatchObject({ likes: 0, liked: false })
  })

  it('只影响目标内容，其他内容保持不变', () => {
    const store = createPostStore(countingDeps())
    const target = store.add('被点赞的')
    const other = store.add('被忽略的')

    store.toggleLike(target.id)

    expect(store.get(target.id)).toMatchObject({ likes: 1, liked: true })
    expect(store.get(other.id)).toMatchObject({ likes: 0, liked: false })
  })

  it('id 不存在时返回 undefined 且不改动数据', () => {
    const store = createPostStore(countingDeps())
    store.add('唯一一条')

    expect(store.toggleLike('missing')).toBeUndefined()
    expect(store.list()[0]).toMatchObject({ likes: 0, liked: false })
  })

  it('返回副本，外部修改不影响内部数据', () => {
    const store = createPostStore(countingDeps())
    const { id } = store.add('副本检查')

    const updated = store.toggleLike(id)
    if (updated) updated.likes = 99

    expect(store.get(id)?.likes).toBe(1)
  })
})

describe('createPostStore 收藏', () => {
  it('新内容初始未收藏', () => {
    expect(createPostStore(countingDeps()).add('新内容').bookmarked).toBe(false)
  })

  it('切换后收藏，再次切换取消', () => {
    const store = createPostStore(countingDeps())
    const { id } = store.add('想留着')

    expect(store.toggleBookmark(id)).toMatchObject({ bookmarked: true })
    expect(store.toggleBookmark(id)).toMatchObject({ bookmarked: false })
  })

  it('收藏与点赞互不影响', () => {
    const store = createPostStore(countingDeps())
    const { id } = store.add('两个都想要')

    store.toggleBookmark(id)
    expect(store.get(id)).toMatchObject({ liked: false, likes: 0, bookmarked: true })

    store.toggleLike(id)
    expect(store.get(id)).toMatchObject({ liked: true, likes: 1, bookmarked: true })
  })

  it('id 不存在时返回 undefined', () => {
    const store = createPostStore(countingDeps())
    store.add('存在的')

    expect(store.toggleBookmark('missing')).toBeUndefined()
  })
})
