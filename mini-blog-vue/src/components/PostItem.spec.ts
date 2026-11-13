import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toggleBookmark, toggleLike } from '../lib/api'
import { usePostsStore } from '../stores/posts'
import type { Post } from '../types'
import PostItem from './PostItem.vue'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, toggleLike: vi.fn(), toggleBookmark: vi.fn() }
})

const mockedToggleLike = vi.mocked(toggleLike)
const mockedToggleBookmark = vi.mocked(toggleBookmark)

const NOW = new Date(2026, 10, 13, 12, 0, 0).getTime()

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  mockedToggleLike.mockReset()
  mockedToggleBookmark.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const makePost = (extra: Partial<Post> = {}): Post => ({
  id: 'a',
  content: '第一条想法',
  createdAt: NOW,
  likes: 0,
  liked: false,
  bookmarked: false,
  ...extra
})

const mountItem = (post: Post) =>
  mount(PostItem, { props: { post }, global: { plugins: [pinia] } })

/** 以 store 中的真实记录挂载，确保点击走完整的乐观更新链路 */
const mountWithStore = (post: Post) => {
  const store = usePostsStore()
  store.posts = [post]
  return { wrapper: mountItem(store.posts[0] as Post), store }
}

describe('PostItem', () => {
  it('显示作者、正文与相对时间', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const wrapper = mountItem(makePost({ createdAt: NOW - 5 * 60_000 }))

    expect(wrapper.get('.post-name').text()).toBe('我')
    expect(wrapper.get('.post-content').text()).toBe('第一条想法')
    expect(wrapper.get('.post-time').text()).toBe('5 分钟前')
  })

  it('正文中的 HTML 被当作纯文本渲染', () => {
    const wrapper = mountItem(makePost({ content: '<img src=x onerror="alert(1)">' }))

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.post-content').text()).toBe('<img src=x onerror="alert(1)">')
  })

  it('保留正文中的换行', () => {
    const wrapper = mountItem(makePost({ content: '第一行\n第二行' }))

    expect(wrapper.get('.post-content').text()).toBe('第一行\n第二行')
  })

  it('展示点赞数与收藏状态', () => {
    const wrapper = mountItem(makePost({ likes: 3, liked: true, bookmarked: true }))

    expect(wrapper.get('.like-count').text()).toBe('3')
    expect(wrapper.get('.like-btn').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.like-btn').attributes('aria-label')).toBe('取消点赞')
    expect(wrapper.get('.bookmark-btn').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.bookmark-label').text()).toBe('已收藏')
  })

  it('点赞成功后计数与状态同步更新', async () => {
    const { wrapper, store } = mountWithStore(makePost())
    mockedToggleLike.mockResolvedValue(makePost({ likes: 1, liked: true }))

    await wrapper.get('.like-btn').trigger('click')
    await flushPromises()

    expect(mockedToggleLike).toHaveBeenCalledWith('a')
    expect(wrapper.get('.like-count').text()).toBe('1')
    expect(wrapper.get('.like-btn').attributes('aria-pressed')).toBe('true')
    expect(store.posts[0]).toMatchObject({ liked: true, likes: 1 })
  })

  it('收藏成功后文案切换为已收藏', async () => {
    const { wrapper } = mountWithStore(makePost())
    mockedToggleBookmark.mockResolvedValue(makePost({ bookmarked: true }))

    await wrapper.get('.bookmark-btn').trigger('click')
    await flushPromises()

    expect(mockedToggleBookmark).toHaveBeenCalledWith('a')
    expect(wrapper.get('.bookmark-label').text()).toBe('已收藏')
    expect(wrapper.get('.bookmark-btn').attributes('aria-pressed')).toBe('true')
  })

  it('请求在途时按钮禁用，避免重复提交', async () => {
    const { wrapper } = mountWithStore(makePost())
    let resolveLike!: (post: Post) => void
    mockedToggleLike.mockReturnValue(
      new Promise<Post>((resolve) => {
        resolveLike = resolve
      })
    )

    await wrapper.get('.like-btn').trigger('click')

    expect(wrapper.get('.like-btn').attributes('disabled')).toBeDefined()

    resolveLike(makePost({ likes: 1, liked: true }))
    await flushPromises()

    expect(wrapper.get('.like-btn').attributes('disabled')).toBeUndefined()
  })
})
