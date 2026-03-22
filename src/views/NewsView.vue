<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNewsStore } from '@/stores/news'
import { useDkpStore } from '@/stores/dkp'
import { useToast } from '@/composables/useToast'
import type { NewsPost } from '@/types'
import NewsCard from '@/components/news/NewsCard.vue'
import NewsForm from '@/components/news/NewsForm.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

const auth = useAuthStore()
const news = useNewsStore()
const dkp = useDkpStore()
const { toast } = useToast()

const showForm = ref(false)
const editPost = ref<NewsPost | null>(null)
const deleteTarget = ref<NewsPost | null>(null)
const saving = ref(false)

onMounted(async () => {
  if (!news.posts.length) await news.load()
  if (!dkp.config) await dkp.load()
})

const isNewsEditor = computed(() => {
  if (!auth.isLoggedIn) return false
  if (auth.isAdmin) return true
  const username = auth.user?.username
  if (!username || !dkp.config?.roles) return false
  const lower = username.toLowerCase()
  const role = dkp.config.roles[lower]
  if (role === 'admin' || role === 'officer') return true
  const prefix = lower.split('#')[0]
  if (prefix !== lower && dkp.config.roles[prefix]) {
    const r = dkp.config.roles[prefix]
    return r === 'admin' || r === 'officer'
  }
  return false
})

function openCreate() {
  editPost.value = null
  showForm.value = true
}

function openEdit(post: NewsPost) {
  editPost.value = post
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editPost.value = null
}

async function handleSave(data: { id?: string; title: string; content: string; pinned: boolean }) {
  saving.value = true
  try {
    await news.save(data)
    showForm.value = false
    editPost.value = null
    toast(data.id ? 'Beitrag aktualisiert' : 'Beitrag erstellt')
  } catch (err) {
    toast('Fehler beim Speichern')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await news.remove(deleteTarget.value.id)
    toast('Beitrag gel\u00f6scht')
  } catch {
    toast('Fehler beim L\u00f6schen')
  } finally {
    deleteTarget.value = null
  }
}
</script>

<template>
  <div id="v-news">
    <div class="news-top">
      <h2 class="news-heading">Neuigkeiten</h2>
      <button v-if="isNewsEditor && !showForm" id="news-create-btn" class="news-create-btn" @click="openCreate">
        + Neuer Beitrag
      </button>
    </div>

    <NewsForm
      v-if="showForm"
      :edit-post="editPost"
      @save="handleSave"
      @cancel="cancelForm"
    />

    <div v-if="news.loading" class="news-loading">Lade Neuigkeiten&hellip;</div>

    <template v-else-if="news.posts.length">
      <NewsCard
        v-for="post in news.posts"
        :key="post.id"
        :post="post"
        :can-edit="isNewsEditor"
        @edit="openEdit"
        @delete="deleteTarget = $event"
      />
    </template>

    <div v-else class="news-empty">
      Noch keine Neuigkeiten vorhanden.
    </div>

    <ConfirmModal
      :open="!!deleteTarget"
      title="Beitrag l&ouml;schen"
      :message="`&quot;${deleteTarget?.title}&quot; wirklich l\u00f6schen?`"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<style scoped>
.news-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.news-heading {
  font: 700 22px var(--font-heading);
  color: var(--color-gold);
  margin: 0;
}

.news-create-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  border: none;
  cursor: pointer;
  transition: filter 0.15s;
}

.news-create-btn:hover {
  filter: brightness(1.1);
}

.news-loading,
.news-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-tx3);
  font-size: 14px;
}
</style>
