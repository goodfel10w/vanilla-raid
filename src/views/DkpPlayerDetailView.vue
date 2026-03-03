<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDkpStore } from '@/stores/dkp'
import DkpPlayerDetail from '@/components/dkp/DkpPlayerDetail.vue'

const route = useRoute()
const router = useRouter()
const dkp = useDkpStore()

const playerName = computed(() => decodeURIComponent(route.params.name as string))

function handleClose() {
  router.push('/dkp')
}

onMounted(() => {
  if (!dkp.balances.length) {
    dkp.load()
  }
})
</script>

<template>
  <div id="v-dkp">
    <DkpPlayerDetail
      :player-name="playerName"
      @close="handleClose"
    />
  </div>
</template>

<style scoped>
#v-dkp {
  max-width: 800px;
}
</style>
