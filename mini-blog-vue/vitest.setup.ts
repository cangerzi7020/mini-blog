import { beforeEach } from 'vitest'

// 每个用例都从干净的本地存储出发，避免用例之间互相污染
beforeEach(() => {
  localStorage.clear()
})
