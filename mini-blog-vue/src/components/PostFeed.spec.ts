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

const post = (id: string, createdAt = 1, content = `第 ${id} 条`): Post => ({
  id,
  content,
  createdAt
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
