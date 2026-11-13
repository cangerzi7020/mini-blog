import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { SAVE_ERROR, STORAGE_KEY } from '../lib/constants'
import { EMPTY_ERROR } from '../lib/text'
import { usePostsStore } from '../stores/posts'
import PostComposer from './PostComposer.vue'

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  vi.restoreAllMocks()
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
  it('点击发布写入存储并清空输入', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('  第一条想法  ')
    await button(wrapper).trigger('click')

    expect(store.posts.map((post) => post.content)).toEqual(['第一条想法'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1)
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.get('#char-count').text()).toBe('0 / 140')
  })

  it('Ctrl + Enter 快捷发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('键盘发布')
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(store.posts.map((post) => post.content)).toEqual(['键盘发布'])
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('')
  })

  it('Cmd + Enter 快捷发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('Mac 上也能发')
    await input(wrapper).trigger('keydown', { key: 'Enter', metaKey: true })

    expect(store.posts.map((post) => post.content)).toEqual(['Mac 上也能发'])
  })

  it('单独的 Enter 不会发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await input(wrapper).setValue('换行而已')
    await input(wrapper).trigger('keydown', { key: 'Enter' })

    expect(store.posts).toEqual([])
  })

  it('空白内容用快捷键提交时给出提示', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('    ')
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.get('#compose-error').text()).toBe(EMPTY_ERROR)
  })

  it('保存失败时展示错误且保留输入内容', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const wrapper = mountComposer()

    await input(wrapper).setValue('不该丢掉的内容')
    await button(wrapper).trigger('click')

    expect(wrapper.get('#compose-error').text()).toBe(SAVE_ERROR)
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('不该丢掉的内容')
  })

  it('继续输入时清除错误提示', async () => {
    const wrapper = mountComposer()

    await input(wrapper).setValue('    ')
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.find('#compose-error').exists()).toBe(true)

    await input(wrapper).setValue('继')
    await nextTick()

    expect(wrapper.find('#compose-error').exists()).toBe(false)
  })
})
