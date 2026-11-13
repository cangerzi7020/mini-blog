import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'
import { STORAGE_KEY } from './lib/constants'

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

const mountApp = (): VueWrapper => mount(App, { global: { plugins: [pinia] } })

const dispatchStorage = async (key: string | null): Promise<void> => {
  window.dispatchEvent(new StorageEvent('storage', { key }))
  await nextTick()
}

describe('App', () => {
  it('渲染品牌与页脚', () => {
    const wrapper = mountApp()

    expect(wrapper.get('.brand-name').text()).toBe('橘生淮南')
    expect(wrapper.get('.footer').text()).toContain('极简的本地记录小站')

    wrapper.unmount()
  })

  it('挂载时读取 localStorage 中已有的内容', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', content: '上次写的内容', createdAt: 1 }])
    )

    const wrapper = mountApp()

    expect(wrapper.get('.post-content').text()).toBe('上次写的内容')

    wrapper.unmount()
  })

  it('其他标签页写入后通过 storage 事件同步列表', async () => {
    const wrapper = mountApp()
    expect(wrapper.find('.post').exists()).toBe(false)

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'b', content: '别的标签页写的', createdAt: 2 }])
    )
    await dispatchStorage(STORAGE_KEY)

    expect(wrapper.get('.post-content').text()).toBe('别的标签页写的')

    wrapper.unmount()
  })

  it('无关的 storage 事件不会刷新列表', async () => {
    const wrapper = mountApp()

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'c', content: '不相关的 key', createdAt: 3 }])
    )
    await dispatchStorage('unrelated-key')

    expect(wrapper.find('.post').exists()).toBe(false)

    wrapper.unmount()
  })
})
