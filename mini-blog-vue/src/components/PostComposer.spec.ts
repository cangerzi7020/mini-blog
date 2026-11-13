import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { ApiError, createPost, fetchPosts } from '../lib/api'
import { SAVE_ERROR } from '../lib/constants'
import { EMPTY_ERROR } from '../lib/text'
import { usePostsStore } from '../stores/posts'
import type { Post } from '../types'
import PostComposer from './PostComposer.vue'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, fetchPosts: vi.fn(), createPost: vi.fn() }
})

const mockedFetchPosts = vi.mocked(fetchPosts)
const mockedCreatePost = vi.mocked(createPost)

let pinia: Pinia

/** 手动放行的 Promise，用于观察请求进行中的界面状态 */
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  mockedFetchPosts.mockReset()
  mockedCreatePost.mockReset()
  mockedFetchPosts.mockResolvedValue([])
  // 默认回显提交内容，模拟后端生成记录
  mockedCreatePost.mockImplementation(async (content) => ({
    id: 'new',
    content,
    createdAt: 2
  }))
})

const mountComposer = (): VueWrapper =>
  mount(PostComposer, { global: { plugins: [pinia] } })

const input = (wrapper: VueWrapper) => wrapper.get('#compose-input')
const button = (wrapper: VueWrapper) => wrapper.get('#publish-btn')

describe('字数与按钮状态', () => {
  it('初始显示 0 / 140 且发布按钮禁用', () => {
    const wrapper = mountComposer()

    expect(wrapper.get('#char-count').text()).toBe('0 / 140')
    expect(button(wrapper).attributes('disabled')).toBeDefined()
  })

  it('输入后按码点更新计数并启用按钮', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('橘🍊ab')

    expect(wrapper.get('#char-count').text()).toBe('4 / 140')
    expect(button(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('纯空白不启用按钮', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('   ')

    expect(button(wrapper).attributes('disabled')).toBeDefined()
  })

  it('接近上限时提示 warn 样式', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('字'.repeat(130))

    expect(wrapper.get('#char-count').classes()).toContain('warn')
  })

  it('超出上限时标记 over 并禁用按钮', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('字'.repeat(141))

    expect(wrapper.get('#char-count').classes()).toContain('over')
    expect(button(wrapper).attributes('disabled')).toBeDefined()
  })
})

describe('发布', () => {
  it('点击发布调用接口并清空输入', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('  第一条想法  ')
    await button(wrapper).trigger('click')
    await flushPromises()

    expect(mockedCreatePost).toHaveBeenCalledWith('第一条想法')
    expect(store.posts.map((item) => item.content)).toEqual(['第一条想法'])
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.get('#char-count').text()).toBe('0 / 140')
  })

  it('发布期间禁用按钮，完成后清空输入', async () => {
    const pending = deferred<Post>()
    mockedCreatePost.mockReturnValue(pending.promise)
    const wrapper = mountComposer()

    await input(wrapper).setValue('还没回来的内容')
    await button(wrapper).trigger('click')
    await nextTick()

    expect(button(wrapper).attributes('disabled')).toBeDefined()
    expect(mockedCreatePost).toHaveBeenCalledTimes(1)

    pending.resolve({ id: 'new', content: '还没回来的内容', createdAt: 2 })
    await flushPromises()

    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('')
  })

  it('Ctrl + Enter 快捷发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('键盘发布')
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(store.posts.map((item) => item.content)).toEqual(['键盘发布'])
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('')
  })

  it('Cmd + Enter 快捷发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('Mac 上也能发')
    await input(wrapper).trigger('keydown', { key: 'Enter', metaKey: true })
    await flushPromises()

    expect(store.posts.map((item) => item.content)).toEqual(['Mac 上也能发'])
  })

  it('单独的 Enter 不会发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('换行而已')
    await input(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(store.posts).toEqual([])
    expect(mockedCreatePost).not.toHaveBeenCalled()
  })

  it('空白内容用快捷键提交时给出提示且不发请求', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('    ')
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(wrapper.get('#compose-error').text()).toBe(EMPTY_ERROR)
    expect(mockedCreatePost).not.toHaveBeenCalled()
  })

  it('发布失败时展示错误且保留输入内容', async () => {
    mockedCreatePost.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))
    const wrapper = mountComposer()

    await input(wrapper).setValue('不该丢掉的内容')
    await button(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.get('#compose-error').text()).toBe(SAVE_ERROR)
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('不该丢掉的内容')
  })

  it('继续输入时清除错误提示', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('    ')
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()
    expect(wrapper.find('#compose-error').exists()).toBe(true)

    await input(wrapper).setValue('继')
    await nextTick()

    expect(wrapper.find('#compose-error').exists()).toBe(false)
  })
})
