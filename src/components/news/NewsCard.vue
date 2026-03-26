<script setup lang="ts">
import type { NewsPost } from '@/types'
import { timeAgo } from '@/lib/utils'

defineProps<{
  post: NewsPost
  canEdit: boolean
}>()

defineEmits<{
  edit: [post: NewsPost]
  delete: [post: NewsPost]
}>()
</script>

<template>
  <div class="news-card">
    <div class="news-header">
      <div class="news-title-row">
        <span v-if="post.pinned" class="news-pinned">Angepinnt</span>
        <h3 class="news-title">{{ post.title }}</h3>
      </div>
      <div v-if="canEdit" class="news-actions">
        <button class="news-btn" data-news-edit @click="$emit('edit', post)">Bearbeiten</button>
        <button class="news-btn del" data-news-del @click="$emit('delete', post)">L&ouml;schen</button>
      </div>
    </div>
    <div class="news-content">{{ post.content }}</div>
    <div class="news-meta">
      <span>{{ post.author }}</span>
      <span>&middot;</span>
      <span>{{ timeAgo(post.createdAt) }}</span>
      <template v-if="post.updatedAt !== post.createdAt">
        <span>&middot;</span>
        <span>bearbeitet {{ timeAgo(post.updatedAt) }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.news-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
}

.news-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.news-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.news-title {
  font: 600 16px var(--font-heading);
  color: var(--color-gold);
  margin: 0;
}

.news-pinned {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.3);
  white-space: nowrap;
}

.news-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.news-btn {
  font: 600 11px var(--font-body);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx3);
  cursor: pointer;
  transition: all 0.15s;
}

.news-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-tx);
}

.news-btn.del:hover {
  border-color: rgba(229, 115, 115, 0.4);
  color: #e57373;
}

.news-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-tx2);
  white-space: pre-wrap;
  word-break: break-word;
}

.news-meta {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-tx4);
}

@media (max-width: 767px) {
  .news-header {
    flex-direction: column;
  }
}
</style>
