<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NewsPost } from '@/types'

const props = defineProps<{
  editPost?: NewsPost | null
}>()

const emit = defineEmits<{
  save: [data: { id?: string; title: string; content: string; pinned: boolean }]
  cancel: []
}>()

const title = ref('')
const content = ref('')
const pinned = ref(false)

watch(() => props.editPost, (post) => {
  if (post) {
    title.value = post.title
    content.value = post.content
    pinned.value = post.pinned
  } else {
    title.value = ''
    content.value = ''
    pinned.value = false
  }
}, { immediate: true })

function submit() {
  if (!title.value.trim() || !content.value.trim()) return
  emit('save', {
    id: props.editPost?.id,
    title: title.value.trim(),
    content: content.value.trim(),
    pinned: pinned.value,
  })
}
</script>

<template>
  <div class="news-form">
    <div class="nf-title">{{ editPost ? 'Beitrag bearbeiten' : 'Neuer Beitrag' }}</div>
    <label class="nf-label" for="news-f-title">Titel</label>
    <input
      id="news-f-title"
      v-model="title"
      class="nf-input"
      type="text"
      maxlength="200"
      placeholder="Titel des Beitrags"
    />
    <label class="nf-label" for="news-f-content">Inhalt</label>
    <textarea
      id="news-f-content"
      v-model="content"
      class="nf-input nf-textarea"
      maxlength="5000"
      rows="6"
      placeholder="Inhalt des Beitrags..."
    ></textarea>
    <label class="nf-check-label">
      <input id="news-f-pinned" v-model="pinned" type="checkbox" class="nf-check" />
      Angepinnt
    </label>
    <div class="nf-actions">
      <button id="news-f-submit" class="nf-btn primary" :disabled="!title.trim() || !content.trim()" @click="submit">
        Speichern
      </button>
      <button id="news-f-cancel" class="nf-btn" @click="$emit('cancel')">Abbrechen</button>
    </div>
  </div>
</template>

<style scoped>
.news-form {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.nf-title {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.nf-label {
  display: block;
  font: 600 12px var(--font-body);
  color: var(--color-tx3);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nf-input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx);
  font: 14px var(--font-body);
  margin-bottom: 12px;
  box-sizing: border-box;
}

.nf-input:focus {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}

.nf-input::placeholder {
  color: var(--color-tx4);
}

.nf-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
}

.nf-check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 13px var(--font-body);
  color: var(--color-tx2);
  margin-bottom: 16px;
  cursor: pointer;
}

.nf-check {
  accent-color: var(--color-gold);
}

.nf-actions {
  display: flex;
  gap: 8px;
}

.nf-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx3);
  cursor: pointer;
  transition: all 0.15s;
}

.nf-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-tx);
}

.nf-btn.primary {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  border-color: transparent;
}

.nf-btn.primary:hover {
  filter: brightness(1.1);
}

.nf-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
}
</style>
