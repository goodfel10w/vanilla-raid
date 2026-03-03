<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
}>(), {
  message: '',
  confirmLabel: 'Bestätigen',
  cancelLabel: 'Abbrechen',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-bg" @click.self="emit('cancel')">
      <div class="modal">
        <div class="modal-title">{{ title }}</div>
        <div v-if="message" class="modal-msg" v-html="message"></div>
        <slot />
        <div class="modal-btns">
          <button class="modal-cancel" @click="emit('cancel')">{{ cancelLabel }}</button>
          <button class="modal-confirm" @click="emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: #1a1828;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 12px;
  padding: 24px;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-title {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold);
  margin-bottom: 12px;
}

.modal-msg {
  font-size: 14px;
  color: var(--color-tx2);
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-btns {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-cancel {
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx2);
  cursor: pointer;
  font: 14px var(--font-body);
  transition: all 0.15s;
}

.modal-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
}

.modal-confirm {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
  cursor: pointer;
  font: 700 14px var(--font-body);
  transition: all 0.15s;
}

.modal-confirm:hover {
  filter: brightness(1.1);
}
</style>
