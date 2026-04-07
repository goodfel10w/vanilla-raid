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
    id: 'account-hub-v1',
    title: 'Neues Konto & Charakterverwaltung',
    description:
      'Verwalte alle deine Charaktere an einem Ort — mit Übersichtskarten, Main-Charakter-Markierung und schnellem Zugriff auf Bearbeiten und Löschen. Dein Main wird automatisch bei Raid- und Kara-Anmeldungen vorausgewählt.',
    icon: '🛡️',
    route: '/form',
    routeLabel: 'Zu Mein Konto',
    addedAt: '2026-04-07',
  },
  {
    id: 'improved-signup-v1',
    title: 'Verbesserte Raid-Anmeldung',
    description:
      'Die Charakterauswahl bei Raid- und Kara-Anmeldungen wurde überarbeitet — dein Main-Charakter wird automatisch vorausgewählt, Specs bleiben beim Wechsel zwischen gleichen Klassen erhalten.',
    icon: '⚔️',
    route: '/raids',
    routeLabel: 'Zu den Raids',
    addedAt: '2026-04-07',
  },
  {
    id: 'kara-signup-v1',
    title: 'Karazhan Wöchentliche Anmeldung',
    description:
      'Melde dich jede Woche für Karazhan an — wähle deinen Spec, bevorzugte Tage und Zeiten, damit die Raidleitung optimale Gruppen zusammenstellen kann.',
    icon: '⚔️',
    route: '/raids',
    routeLabel: 'Zur Kara-Anmeldung',
    addedAt: '2026-03-01',
  },
  {
    id: 'dkp-system-v1',
    title: 'DKP Loot-System',
    description:
      'Verfolge deine DKP-Punkte, sieh dir die aktuellen Standings an und behalte den Überblick über alle Transaktionen.',
    icon: '💰',
    route: '/dkp',
    routeLabel: 'Zu den DKP-Standings',
    addedAt: '2026-02-15',
  },
  {
    id: 'news-v1',
    title: 'Gilden-News',
    description:
      'Bleib auf dem Laufenden mit den neuesten Gilden-Nachrichten direkt im Dashboard. Offiziere können wichtige Beiträge anpinnen.',
    icon: '📜',
    route: '/news',
    routeLabel: 'Zu den News',
    addedAt: '2026-02-01',
  },
]
