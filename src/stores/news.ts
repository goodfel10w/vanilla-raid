import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { NewsPost } from '@/types'
import { api } from '@/lib/api'

export const useNewsStore = defineStore('news', () => {
  const posts = ref<NewsPost[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const data = await api.get<NewsPost[]>('/api/news')
      posts.value = Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Failed to load news:', err)
      posts.value = []
    } finally {
      loading.value = false
    }
  }

  async function save(data: Partial<NewsPost>) {
    await api.post('/api/news', data)
    await load()
  }

  async function remove(id: string) {
    await api.del(`/api/news?id=${encodeURIComponent(id)}`)
    await load()
  }

  return { posts, loading, load, save, remove }
})
