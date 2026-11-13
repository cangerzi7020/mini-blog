import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PostItem from './PostItem.vue'

const NOW = new Date(2026, 10, 13, 12, 0, 0).getTime()

afterEach(() => {
  vi.useRealTimers()
})

const mountItem = (content: string, createdAt: number) =>
  mount(PostItem, { props: { post: { id: 'a', content, createdAt } } })

describe('PostItem', () => {
  it('显示作者、正文与相对时间', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const wrapper = mountItem('第一条想法', NOW - 5 * 60_000)

    expect(wrapper.get('.post-name').text()).toBe('我')
    expect(wrapper.get('.post-content').text()).toBe('第一条想法')
    expect(wrapper.get('.post-time').text()).toBe('5 分钟前')
  })

  it('正文中的 HTML 被当作纯文本渲染', () => {
    const wrapper = mountItem('<img src=x onerror="alert(1)">', NOW)

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.post-content').text()).toBe('<img src=x onerror="alert(1)">')
  })

  it('保留正文中的换行', () => {
    const wrapper = mountItem('第一行\n第二行', NOW)

    expect(wrapper.get('.post-content').text()).toBe('第一行\n第二行')
  })
})
