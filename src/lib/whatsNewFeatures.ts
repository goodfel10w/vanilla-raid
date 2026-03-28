export interface WhatsNewFeature {
  id: string
  title: string
  description: string
  icon: string
  route?: string
  routeLabel?: string
  addedAt: string
}

export const WHATS_NEW_FEATURES: WhatsNewFeature[] = [
  {
    id: 'kara-signup-v1',
    title: 'Karazhan Wöchentliche Anmeldung',
    description:
      'Melde dich jede Woche für Karazhan an — wähle deinen Spec, bevorzugte Tage und Zeiten, damit die Raidleitung optimale Gruppen zusammenstellen kann.',
    icon: '⚔️',
    route: '/kara',
    routeLabel: 'Zur Kara-Planung',
    addedAt: '2026-03-01',
  },
]
