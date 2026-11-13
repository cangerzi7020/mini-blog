import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { STORAGE_KEY } from '../lib/constants'
import { usePostsStore } from '../stores/posts'
import type { Post } from '../types'
import PostFeed from './PostFeed.vue'

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

const seed = (posts: Post[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))

const mountFeed = (): VueWrapper => mount(PostFeed, { global: { plugins: [pinia] } })

describe('PostFeed', () => {
  it('没有内容时显示空状态', () => {
    usePostsStore().load()
    const wrapper = mountFeed()

    expect(wrapper.get('.empty-state').text()).toContain('还没有内容')
    expect(wrapper.findAll('.post')).toHaveLength(0)
  })

  it('有内容时按时间倒序渲染并隐藏空状态', () => {
    seed([
      { id: 'old', content: '最早的想法', createdAt: 1 },
      { id: 'new', content: '最新的想法', createdAt: 2 }
    ])
    usePostsStore().load()
    const wrapper = mountFeed()

    expect(wrapper.findAll('.post')).toHaveLength(2)
    expect(wrapper.findAll('.post-content').map((node) => node.text())).toEqual([
      '最新的想法',
      '最早的想法'
    ])
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('store 新增内容后列表自动更新', async () => {
    usePostsStore().load()
    const wrapper = mountFeed()
    const store = usePostsStore()

    store.publish('刚写下的想法')
    await nextTick()

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.get('.post-content').text()).toBe('刚写下的想法')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })
})
