import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { ApiError, createPost, fetchPosts } from './lib/api'
import { LOAD_ERROR, SAVE_ERROR } from './lib/constants'
import type { Post } from './types'

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>()
  return { ...actual, fetchPosts: vi.fn(), createPost: vi.fn() }
})

const mockedFetchPosts = vi.mocked(fetchPosts)
const mockedCreatePost = vi.mocked(createPost)

let pinia: Pinia

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const post = (id: string, createdAt = 1, content = `第 ${id} 条`): Post => ({
  id,
  content,
  createdAt
})

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  mockedFetchPosts.mockReset()
  mockedCreatePost.mockReset()
  mockedFetchPosts.mockResolvedValue([])
  mockedCreatePost.mockResolvedValue(post('new', 2, '发布的新内容'))
})

const mountApp = (): VueWrapper => mount(App, { global: { plugins: [pinia] } })

const contents = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('.post-content').map((node) => node.text())

describe('App', () => {
  it('渲染品牌与页脚', () => {
    const wrapper = mountApp()

    expect(wrapper.get('.brand-name').text()).toBe('橘生淮南')
    expect(wrapper.get('.footer').text()).toContain('极简的记录小站')
  })

  it('首屏加载接口返回的内容', async () => {
    mockedFetchPosts.mockResolvedValue([post('a', 1, '上次写的内容')])
    const wrapper = mountApp()

    await flushPromises()

    expect(contents(wrapper)).toEqual(['上次写的内容'])
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })

  it('加载期间显示加载提示，返回后消失', async () => {
    const pending = deferred<Post[]>()
    mockedFetchPosts.mockReturnValue(pending.promise)
    const wrapper = mountApp()

    expect(wrapper.get('.feed-loading').text()).toBe('加载中…')

    pending.resolve([post('a', 1, '回来了')])
    await flushPromises()

    expect(wrapper.find('.feed-loading').exists()).toBe(false)
    expect(contents(wrapper)).toEqual(['回来了'])
  })

  it('加载失败时提示无法连接服务器', async () => {
    mockedFetchPosts.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))
    const wrapper = mountApp()

    await flushPromises()

    expect(wrapper.get('.feed-error').text()).toContain(LOAD_ERROR)
    expect(wrapper.find('.post').exists()).toBe(false)
  })

  it('发布成功后新内容置顶显示', async () => {
    mockedFetchPosts.mockResolvedValue([post('old', 1, '旧内容')])
    mockedCreatePost.mockResolvedValue(post('new', 2, '刚发布的内容'))
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('#compose-input').setValue('刚发布的内容')
    await wrapper.get('#publish-btn').trigger('click')
    await flushPromises()

    expect(mockedCreatePost).toHaveBeenCalledWith('刚发布的内容')
    expect(contents(wrapper)).toEqual(['刚发布的内容', '旧内容'])
    expect((wrapper.get('#compose-input').element as HTMLTextAreaElement).value).toBe('')
  })

  it('发布失败时提示错误并保留输入', async () => {
    mockedCreatePost.mockRejectedValue(new ApiError('NETWORK_ERROR', '网络异常'))
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('#compose-input').setValue('没网也想发')
    await wrapper.get('#publish-btn').trigger('click')
    await flushPromises()

    expect(wrapper.get('#compose-error').text()).toBe(SAVE_ERROR)
    expect((wrapper.get('#compose-input').element as HTMLTextAreaElement).value).toBe('没网也想发')
    expect(contents(wrapper)).toEqual([])
  })
})
