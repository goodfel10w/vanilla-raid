<script setup lang="ts">
import type { NewsPost } from '@/types'
import { timeAgo } from '@/lib/utils'

defineProps<{
  posts: NewsPost[]
}>()

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '\u2026'
}
</script>

<template>
  <div v-if="posts.length" class="card dash-card news-dashboard-card">
    <div class="card-t">Neuigkeiten</div>
    <div v-for="post in posts" :key="post.id" class="nd-item">
      <div class="nd-top">
        <span v-if="post.pinned" class="nd-pin">Angepinnt</span>
        <span class="nd-title">{{ post.title }}</span>
      </div>
      <div class="nd-body">{{ truncate(post.content, 120) }}</div>
      <div class="nd-meta">{{ post.author }} &middot; {{ timeAgo(post.createdAt) }}</div>
    </div>
    <router-link to="/news" class="nd-link">Alle Neuigkeiten &rarr;</router-link>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}
.dash-card { margin-bottom: 16px; }
.card-t {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 16px;
}

.nd-item {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 8px;
}

.nd-item:last-of-type {
  margin-bottom: 12px;
}

.nd-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.nd-pin {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.3);
}

.nd-title {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
}

.nd-body {
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-tx3);
}

.nd-meta {
  font-size: 11px;
  color: var(--color-tx4);
  margin-top: 4px;
}

.nd-link {
  display: block;
  text-align: center;
  font: 600 12px var(--font-body);
  color: var(--color-gold);
  text-decoration: none;
  padding: 6px;
  border-radius: 6px;
  transition: background 0.15s;
}

.nd-link:hover {
  background: rgba(201, 168, 76, 0.08);
}
</style>
