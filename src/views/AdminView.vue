<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AdminOverview from '@/components/admin/AdminOverview.vue'
import AdminEntries from '@/components/admin/AdminEntries.vue'
import AdminManage from '@/components/admin/AdminManage.vue'
import AdminRoles from '@/components/admin/AdminRoles.vue'

const authStore = useAuthStore()
const activeTab = ref<'overview' | 'entries' | 'roles' | 'manage'>('overview')

const isAdmin = computed(() => authStore.isAdmin)
</script>

<template>
  <div id="v-admin">
    <div v-if="!isAdmin" class="adm-no-access">
      Kein Zugriff &mdash; nur fuer Admins sichtbar.
    </div>

    <template v-else>
      <div class="adm-tabs">
        <button
          class="adm-tab"
          :class="{ active: activeTab === 'overview' }"
          @click="activeTab = 'overview'"
        >Uebersicht</button>
        <button
          class="adm-tab"
          :class="{ active: activeTab === 'entries' }"
          @click="activeTab = 'entries'"
        >Eintraege</button>
        <button
          class="adm-tab"
          :class="{ active: activeTab === 'roles' }"
          @click="activeTab = 'roles'"
        >Rollen</button>
        <button
          class="adm-tab"
          :class="{ active: activeTab === 'manage' }"
          @click="activeTab = 'manage'"
        >Verwaltung</button>
      </div>

      <AdminOverview v-if="activeTab === 'overview'" />
      <AdminEntries v-else-if="activeTab === 'entries'" />
      <AdminRoles v-else-if="activeTab === 'roles'" />
      <AdminManage v-else-if="activeTab === 'manage'" />
    </template>
  </div>
</template>

<style scoped>
.adm-no-access {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-tx3);
  font-size: 16px;
  font-weight: 600;
}

.adm-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.adm-tab {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}

.adm-tab:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-tx2);
}

.adm-tab.active {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.25);
  color: var(--color-gold);
}
</style>
