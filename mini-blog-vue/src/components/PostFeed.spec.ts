import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { LOAD_ERROR } from '../lib/constants'
import { usePostsStore } from '../stores/posts'
import type { Post } from '../types'
import PostFeed from './PostFeed.vue'

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

const mountFeed = (): VueWrapper => mount(PostFeed, { global: { plugins: [pinia] } })

const post = (
  id: string,
  createdAt = 1,
  content = `第 ${id} 条`,
  extra: Partial<Post> = {}
): Post => ({
  id,
  content,
  createdAt,
  likes: 0,
  liked: false,
  bookmarked: false,
  ...extra
})

describe('PostFeed', () => {
  it('没有内容时显示空状态', () => {
    const wrapper = mountFeed()

    expect(wrapper.get('.empty-state').text()).toContain('还没有内容')
    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('.feed-loading').exists()).toBe(false)
    expect(wrapper.find('.feed-error').exists()).toBe(false)
  })

  it('有内容时按时间倒序渲染并隐藏空状态', () => {
    usePostsStore().posts = [post('new', 2, '最新的想法'), post('old', 1, '最早的想法')]
    const wrapper = mountFeed()

    expect(wrapper.findAll('.post')).toHaveLength(2)
    expect(wrapper.findAll('.post-content').map((node) => node.text())).toEqual([
      '最新的想法',
      '最早的想法'
    ])
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('首屏加载中显示加载提示且不显示空状态', () => {
    const store = usePostsStore()
    store.posts = []
    store.loading = true
    const wrapper = mountFeed()

    expect(wrapper.get('.feed-loading').text()).toBe('加载中…')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('已有内容时刷新不显示加载提示', () => {
    const store = usePostsStore()
    store.posts = [post('a', 1, '已有内容')]
    store.loading = true
    const wrapper = mountFeed()

    expect(wrapper.find('.feed-loading').exists()).toBe(false)
    expect(wrapper.get('.post-content').text()).toBe('已有内容')
  })

  it('加载失败时以 alert 展示错误文案', () => {
    const store = usePostsStore()
    store.posts = []
    store.loadError = LOAD_ERROR
    const wrapper = mountFeed()

    const error = wrapper.get('.feed-error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain(LOAD_ERROR)
    expect(wrapper.find('.feed-loading').exists()).toBe(false)
    // 加载失败时不能同时出现「还没有内容」，否则语义矛盾
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('store 新增内容后列表自动更新', async () => {
    const wrapper = mountFeed()
    const store = usePostsStore()
    expect(wrapper.find('.empty-state').exists()).toBe(true)

    store.posts = [post('new', 2, '刚写下的想法')]
    await nextTick()

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.get('.post-content').text()).toBe('刚写下的想法')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })
})

describe('PostFeed 筛选', () => {
  const seed = () => {
    usePostsStore().posts = [
      post('a', 3, '被收藏的', { bookmarked: true }),
      post('b', 2, '普通的'),
      post('c', 1, '也收藏了', { bookmarked: true })
    ]
  }

  it('有内容时展示全部与收藏两个标签及各自数量', () => {
    seed()
    const wrapper = mountFeed()

    const labels = wrapper.findAll('.feed-tab-label').map((node) => node.text())
    const counts = wrapper.findAll('.feed-tab-count').map((node) => node.text())

    expect(labels).toEqual(['全部', '收藏'])
    expect(counts).toEqual(['3', '2'])
    expect(wrapper.findAll('.feed-tab')[0]?.attributes('aria-pressed')).toBe('true')
  })

  it('点击收藏标签后只展示已收藏内容', async () => {
    seed()
    const wrapper = mountFeed()

    await wrapper.findAll('.feed-tab')[1]?.trigger('click')

    expect(wrapper.findAll('.post-content').map((node) => node.text())).toEqual([
      '被收藏的',
      '也收藏了'
    ])
    expect(wrapper.findAll('.feed-tab')[1]?.attributes('aria-pressed')).toBe('true')
  })

  it('没有收藏时展示收藏专属空状态', async () => {
    usePostsStore().posts = [post('a', 1, '未收藏')]
    const wrapper = mountFeed()

    await wrapper.findAll('.feed-tab')[1]?.trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.get('.empty-state').text()).toContain('还没有收藏')
  })

  it('互动失败时以 alert 展示错误并保留列表', () => {
    const store = usePostsStore()
    store.posts = [post('a', 1, '仍然可见')]
    store.actionError = '操作失败，请稍后重试。'
    const wrapper = mountFeed()

    const error = wrapper.get('.feed-action-error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toBe('操作失败，请稍后重试。')
    expect(wrapper.findAll('.post')).toHaveLength(1)
  })

  it('切换筛选会清空互动错误提示', async () => {
    const store = usePostsStore()
    store.posts = [post('a', 1, '有错误')]
    store.actionError = '操作失败'
    const wrapper = mountFeed()

    await wrapper.findAll('.feed-tab')[0]?.trigger('click')
    await nextTick()

    expect(store.actionError).toBe('')
    expect(wrapper.find('.feed-action-error').exists()).toBe(false)
  })
})
