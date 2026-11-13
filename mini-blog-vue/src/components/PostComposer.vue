<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_LENGTH } from '../lib/constants'
import { countChars } from '../lib/text'
import { usePostsStore } from '../stores/posts'

const store = usePostsStore()

const text = ref('')
const textareaEl = ref<HTMLTextAreaElement | null>(null)
// 请求进行中：避免重复提交，也避免内容被清空前再次发布
const busy = ref(false)

// 与 store/后端一致：首尾空白不参与计数，避免「按钮禁用但内容其实合法」
const trimmed = computed(() => text.value.trim())
const length = computed(() => countChars(trimmed.value))
const isOver = computed(() => length.value > MAX_LENGTH)
const isWarn = computed(() => !isOver.value && length.value > MAX_LENGTH - 20)

// 空内容或超限时禁用按钮，避免无效提交
const canPublish = computed(() => trimmed.value.length > 0 && !isOver.value)

/** 输入即清掉上一次的错误，避免旧提示滞留在界面上 */
function onInput(): void {
  store.clearError()
}

/** 校验与提交都交给 store：成功才清空输入，失败保留内容不丢失 */
async function submit(): Promise<void> {
  if (busy.value) return

  busy.value = true
  try {
    if (await store.publish(text.value)) {
      text.value = ''
      textareaEl.value?.focus()
    }
  } finally {
    busy.value = false
  }
}

/** Ctrl/Cmd + Enter 快捷发布；单独 Enter 保留换行 */
function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void submit()
  }
}
</script>

<template>
  <section class="composer card" aria-label="发布新内容">
    <div class="composer-row">
      <div class="avatar" aria-hidden="true">我</div>
      <textarea
        id="compose-input"
        ref="textareaEl"
        v-model="text"
        class="composer-input"
        rows="3"
        aria-label="内容输入框，最多 140 字"
        placeholder="莫道桑榆晚，为霞尚满天"
        @input="onInput"
        @keydown="onKeydown"
      ></textarea>
    </div>

    <p v-if="store.error" id="compose-error" class="composer-error" role="alert">
      {{ store.error }}
    </p>

    <div class="composer-footer">
      <span
        id="char-count"
        class="char-count"
        :class="{ warn: isWarn, over: isOver }"
      >{{ length }} / {{ MAX_LENGTH }}</span>
      <button
        id="publish-btn"
        class="btn-primary"
        type="button"
        :disabled="!canPublish || busy"
        @click="submit"
      >
        {{ busy ? '发布中…' : '发布' }}
      </button>
    </div>
  </section>
</template>
