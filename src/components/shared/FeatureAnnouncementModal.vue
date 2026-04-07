<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const STORAGE_KEY = 'feature-announcement-seen'
const ANNOUNCEMENT_ID = 'account-hub-2026-04'

const router = useRouter()
const show = ref(false)

onMounted(() => {
  try {
    const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    if (!seen.includes(ANNOUNCEMENT_ID)) {
      show.value = true
    }
  } catch {
    show.value = true
  }
})

function dismiss() {
  show.value = false
  try {
    const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    if (!seen.includes(ANNOUNCEMENT_ID)) seen.push(ANNOUNCEMENT_ID)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
  } catch { /* ignore */ }
}

function goToAccount() {
  dismiss()
  router.push('/form')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fa-overlay" @click.self="dismiss">
      <div class="fa-modal">
        <!-- Header -->
        <div class="fa-header">
          <div class="fa-badge">Neu</div>
          <div class="fa-title">Charakterverwaltung</div>
          <div class="fa-subtitle">Verwalte alle deine Charaktere an einem Ort</div>
        </div>

        <!-- Visual preview: mock character cards -->
        <div class="fa-preview">
          <div class="fa-card main">
            <div class="fa-main-tag">Main</div>
            <div class="fa-card-top">
              <div class="fa-icon" style="background: rgba(198, 155, 109, 0.2); color: #C69B6D;">K</div>
              <div>
                <div class="fa-char-name" style="color: #C69B6D;">Thrallkrieger</div>
                <div class="fa-char-class">Krieger</div>
              </div>
            </div>
            <div class="fa-specs">
              <span class="fa-spec" style="color: #5b9bd5; border-color: rgba(91,155,213,0.3); background: rgba(91,155,213,0.08);">Prot</span>
              <span class="fa-spec" style="color: #e57373; border-color: rgba(229,115,115,0.3); background: rgba(229,115,115,0.08);">Fury</span>
            </div>
            <div class="fa-avail"><span class="fa-dot yes"></span>48 Zeitfenster</div>
          </div>

          <div class="fa-card">
            <div class="fa-card-top">
              <div class="fa-icon" style="background: rgba(63,199,235,0.2); color: #3FC7EB;">M</div>
              <div>
                <div class="fa-char-name" style="color: #3FC7EB;">Frostbolzen</div>
                <div class="fa-char-class">Magier</div>
              </div>
            </div>
            <div class="fa-specs">
              <span class="fa-spec" style="color: #e57373; border-color: rgba(229,115,115,0.3); background: rgba(229,115,115,0.08);">Frost</span>
            </div>
            <div class="fa-avail"><span class="fa-dot yes"></span>24 Zeitfenster</div>
          </div>

          <div class="fa-card add">
            <div class="fa-add-icon">+</div>
          </div>
        </div>

        <!-- Feature highlights -->
        <div class="fa-features">
          <div class="fa-feat">
            <span class="fa-feat-icon">&#11088;</span>
            <span><strong>Main-Charakter</strong> &mdash; wird automatisch bei Raid- und Kara-Anmeldungen vorausgewaehlt</span>
          </div>
          <div class="fa-feat">
            <span class="fa-feat-icon">&#9876;&#65039;</span>
            <span><strong>Bessere Anmeldung</strong> &mdash; Specs bleiben beim Charakterwechsel erhalten</span>
          </div>
          <div class="fa-feat">
            <span class="fa-feat-icon">&#128736;&#65039;</span>
            <span><strong>Alles an einem Ort</strong> &mdash; Bearbeiten, Loeschen und Main setzen direkt auf der Karte</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="fa-actions">
          <button class="fa-btn-primary" @click="goToAccount">Mein Konto ansehen</button>
          <button class="fa-btn-secondary" @click="dismiss">Spaeter</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fa-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
  animation: faFadeIn 0.2s ease;
  padding: 16px;
}
@keyframes faFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fa-modal {
  background: linear-gradient(170deg, #1e1a2e, #141220);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6), 0 0 40px rgba(201, 168, 76, 0.05);
  overflow: hidden;
  animation: faSlideUp 0.25s ease;
}
@keyframes faSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Header */
.fa-header {
  padding: 24px 24px 16px;
  text-align: center;
}
.fa-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 3px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-gold-dark), var(--color-gold));
  color: #1a1028;
  margin-bottom: 10px;
}
.fa-title {
  font: 700 22px var(--font-heading);
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}
.fa-subtitle {
  font-size: 13px;
  color: var(--color-tx3);
}

/* Preview cards */
.fa-preview {
  display: flex;
  gap: 8px;
  padding: 0 20px 16px;
  overflow-x: auto;
}
.fa-card {
  flex-shrink: 0;
  width: 150px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 12px;
  position: relative;
}
.fa-card.main {
  border-color: rgba(201, 168, 76, 0.3);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.06);
}
.fa-main-tag {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.fa-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.fa-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 14px var(--font-heading);
  flex-shrink: 0;
}
.fa-char-name {
  font: 700 12px var(--font-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
.fa-char-class {
  font-size: 10px;
  color: var(--color-tx4);
}
.fa-specs {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.fa-spec {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid;
}
.fa-avail {
  font-size: 10px;
  color: var(--color-tx4);
  display: flex;
  align-items: center;
  gap: 4px;
}
.fa-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.fa-dot.yes { background: var(--color-heal); }
.fa-card.add {
  display: flex;
  align-items: center;
  justify-content: center;
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.06);
  min-height: 100px;
}
.fa-add-icon {
  font-size: 24px;
  color: var(--color-tx4);
}

/* Feature highlights */
.fa-features {
  padding: 0 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fa-feat {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--color-tx2);
  line-height: 1.4;
}
.fa-feat strong {
  color: var(--color-tx);
}
.fa-feat-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* Actions */
.fa-actions {
  padding: 16px 24px 24px;
  display: flex;
  gap: 10px;
}
.fa-btn-primary {
  flex: 1;
  padding: 11px 20px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--color-gold-dark), var(--color-gold));
  color: #1a1028;
  font: 700 13px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
}
.fa-btn-primary:hover {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
}
.fa-btn-secondary {
  padding: 11px 20px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-tx3);
  font: 13px var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
}
.fa-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx2);
}

@media (max-width: 767px) {
  .fa-modal { max-width: 100%; }
  .fa-preview { gap: 6px; padding: 0 16px 14px; }
  .fa-card { width: 130px; padding: 10px; }
  .fa-header { padding: 20px 16px 12px; }
  .fa-features { padding: 0 16px 14px; }
  .fa-actions { padding: 14px 16px 20px; }
  .fa-title { font-size: 19px; }
}
</style>
