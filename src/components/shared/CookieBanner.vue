<script setup lang="ts">
import { useCookieConsent } from '@/composables/useCookieConsent'

const { dismissed, dismiss } = useCookieConsent()
</script>

<template>
  <div v-if="!dismissed" class="cookie-banner">
    <p class="cookie-text">
      Diese Seite verwendet nur technisch notwendige Cookies und
      ähnliche Technologien (z.&nbsp;B. für den Battle.net-Login).
      Details findest du in der
      <router-link to="/datenschutz" class="cookie-link">Datenschutzerklärung</router-link>.
    </p>
    <button class="cookie-btn" @click="dismiss">Verstanden</button>
  </div>
</template>

<style scoped>
.cookie-banner {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  max-width: 560px;
  margin: 0 auto;
  background: #1a1828;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 900;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.cookie-text {
  margin: 0;
  font: 400 13px/1.5 var(--font-body);
  color: var(--color-tx2);
  flex: 1;
}

.cookie-link {
  color: var(--color-gold);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cookie-link:hover {
  color: var(--color-gold-light);
}

.cookie-btn {
  flex-shrink: 0;
  padding: 8px 20px;
  border-radius: 8px;
  font: 600 13px var(--font-body);
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  border: none;
  cursor: pointer;
  transition: filter 0.15s;
  white-space: nowrap;
}

.cookie-btn:hover {
  filter: brightness(1.1);
}

@media (max-width: 767px) {
  .cookie-banner {
    bottom: calc(80px + env(safe-area-inset-bottom, 0px) + 12px);
    left: 12px;
    right: 12px;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
  }

  .cookie-btn {
    width: 100%;
    min-height: 44px;
  }
}
</style>
