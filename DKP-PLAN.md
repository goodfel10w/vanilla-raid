# DKP Management — Implementierungsplan

Dieses Dokument beschreibt den Implementierungsplan für das vollständige DKP-System der `<Vanilla>` Gilde, basierend auf den festgelegten Regeln für 25er Raids.

---

## Inhaltsverzeichnis

1. [Ist-Zustand](#1-ist-zustand)
2. [Soll-Zustand (Gilde-Regeln)](#2-soll-zustand-gilde-regeln)
3. [Gap-Analyse](#3-gap-analyse)
4. [Phase 1 — Config & Grundregeln](#4-phase-1--config--grundregeln)
5. [Phase 2 — Raid-DKP Automation](#5-phase-2--raid-dkp-automation)
6. [Phase 3 — Beute-Erfassung (Post-Raid Bidding)](#6-phase-3--beute-erfassung-post-raid-bidding)
7. [Phase 4 — Phasen-Reset](#7-phase-4--phasen-reset)
8. [Phase 5 — Quality of Life & Discord](#8-phase-5--quality-of-life--discord)
9. [Datenmodell-Änderungen](#9-datenmodell-änderungen)
10. [API-Änderungen](#10-api-änderungen)
11. [Frontend-Änderungen](#11-frontend-änderungen)
12. [Test-Strategie](#12-test-strategie)

---

## 1. Ist-Zustand

### Was bereits funktioniert

Das DKP-System hat bereits eine solide Grundlage mit folgenden Features:

**Backend** (`netlify/functions/dkp.mjs`, 748 Zeilen):
- 3 Netlify Blob Stores: `dkp-balances`, `dkp-transactions`, `dkp-config`
- DKP vergeben (award) an mehrere Spieler gleichzeitig
- DKP abziehen (spend) für Beute — manuell pro Spieler
- Prozentualer Verfall (decay) auf alle positiven Salden
- Undo — letzte Transaktion rückgängig machen
- Transaktionen bearbeiten/löschen (Admin)
- Saldo direkt anpassen (Admin)
- Spieler bearbeiten/löschen (Admin)
- Rollenverwaltung (Admin/Offizier)
- Konfiguration speichern

**Frontend** (`public/index.html`, DKP-Bereich ab Zeile ~3140):
- DKP-Übersicht mit sortierbarer Tabelle (Name, Klasse, DKP)
- Spieler-Suche
- Spieler-Detailansicht mit Transaktionshistorie und Statistiken (Verdient/Ausgegeben/Verfall)
- "Mein DKP" Button für eingeloggte Spieler
- DKP vergeben — Spieler-Chips aus Roster, Raid-Picker zum Auto-Selektieren
- Beute verteilen — Spieler-Dropdown, Betrag, Item-Name (Wowhead-Links)
- Verfall — Prozent-Eingabe mit Vorschau
- Einstellungen — Konfig-Felder, Rollenverwaltung
- CSV-Export
- Transaktionshistorie mit Typ-Filtern (Alle/Verdient/Beute/Verfall/Anpassung)
- Transaktionen bearbeiten/löschen (Admin)
- `dkpAwardFromRaid()` — Button auf vergangenen Raids, wechselt zum Award-Tab mit vorausgewählten Teilnehmern

**Tests** (`tests/functional/dkp.spec.js`, 30+ E2E-Tests):
- Admin/Offizier/Normaler User — Rollenbasierte UI-Tests
- Award, Spend, Decay, Undo Workflows
- Settings, Player Detail, Transaction Management
- Sorting, Search, Filter

**Bestehendes Datenmodell:**
```
Balance:      { playerName, className, balance, lastUpdated }
Transaction:  { id, playerName, type:'earn'|'spend'|'decay'|'adjust', amount, reason, createdBy, timestamp }
Config:       { roles, defaultDecayPercent, maxDkpAmount, allowNegativeBalance, startingBalance, transactionLimit, reasonMaxLength }
```

### Bestehende Raid-Integration

Das Raid-System (`netlify/functions/raids.mjs`) hat bereits:
- Signup-Status: `accepted`, `tentative`, `declined`, `benched`, `confirmed`
- Raid-Erstellung mit Instanz, Datum, Uhrzeit, maxPlayers, Deadline
- Raid sperren/entsperren
- Aufstellung bestätigen
- `dkpAwardFromRaid(raidId)` im Frontend wechselt zum DKP-Award-Tab und selektiert alle Teilnehmer (ohne Declined/Benched) — aber der Offizier muss Betrag und Grund manuell eingeben

---

## 2. Soll-Zustand (Gilde-Regeln)

### DKP verdienen
| Regel | DKP | Bedingung |
|-------|-----|-----------|
| Raidteilnahme (pünktlich, bis zum Ende) | **10** | Pro Raidtag |
| Raidteilnahme (verspätet ODER vorzeitig gegangen) | **5** | Pro Raidtag |
| Bosskill | **5** | Pro Kill |
| Bench (angemeldet, aber nicht mitgenommen) | **10** | Pro Raidtag |
| Erstmalige Raidteilnahme (Startbonus) | **20** | Einmalig pro Spieler |
| Negative DKP | **nicht möglich** | Balance ≥ 0 |
| Gutschrift-Zeitpunkt | **Ende des Raids** | Batch-Verarbeitung |

### DKP ausgeben (Beute)
| Regel | Details |
|-------|---------|
| Bietmodus | Offen — alle Gebote sichtbar |
| Mindestgebot | **5 DKP** |
| Gewinner | Höchstbietender gewinnt |
| Gleichstand | /roll zwischen Höchstbietenden |
| Reihenfolge | **Mainspec vor Offspec** — MS-Gebote werden zuerst ausgewertet |
| Keine Gebote | Item wird entzaubert (Gildenbank) |
| Rezepte & Sonder-Items | Normaler /roll (kein DKP) — z.B. Nethervortex |

### Phasen-Reset
| Regel | Details |
|-------|---------|
| Trigger | Neuer Content-Patch (Phase) |
| Effekt | DKP-Guthaben wird **halbiert** (`FLOOR(balance / 2)`) |

---

## 3. Gap-Analyse

### Was fehlt im Backend

| # | Gap | Beschreibung | Priorität |
|---|-----|-------------|-----------|
| B1 | Raid-DKP Batch-Vergabe | Kein `raid-award` Action der automatisch 10/5 DKP nach Teilnahme-Status vergibt | **Hoch** |
| B2 | Bosskill-Tracking | Kein Datenmodell für Boss-Kills innerhalb eines Raids | **Hoch** |
| B3 | Startbonus-Tracking | Kein `hasReceivedStartingBonus` Flag — Startbonus kann doppelt vergeben werden | **Hoch** |
| B4 | Teilnahme-Status für DKP | Keine Unterscheidung zwischen pünktlich/verspätet/vorzeitig im Raid-Kontext | **Hoch** |
| B5 | No-Negative-DKP Default | Config-Default `allowNegativeBalance: true` statt `false` | **Mittel** |
| B6 | Phasen-Reset Action | Kein `phase-reset` (50% Halbierung) — nur generischer % Decay | **Mittel** |
| B7 | Bidding/Auktion | Kein Auktions-Datenmodell, keine Bid-Erfassung/Resolution | **Mittel** |
| B8 | Loot-History | Kein dediziertes Loot-Log (nur Spend-Transaktionen) | **Niedrig** |

### Was fehlt im Frontend

| # | Gap | Beschreibung | Priorität |
|---|-----|-------------|-----------|
| F1 | Raid-DKP Abrechnung | `dkpAwardFromRaid()` ist nur eine Weiterleitung — kein automatischer Workflow | **Hoch** |
| F2 | Teilnahme-Kategorisierung | Keine UI um Spieler als pünktlich/verspätet/vorzeitig/bench zu markieren | **Hoch** |
| F3 | Bosskill-Eingabe | Keine UI um Boss-Kills im Raid zu erfassen | **Hoch** |
| F4 | Beute-Erfassung mit MS/OS | "Beute" ist aktuell nur manueller Spend — kein MS/OS, kein Mindestgebot | **Mittel** |
| F5 | Phasen-Reset UI | Kein eigener Tab — nur generischer Verfall vorhanden | **Mittel** |
| F6 | Startbonus-Anzeige | Keine Sichtbarkeit ob ein Spieler den Startbonus bereits erhalten hat | **Niedrig** |

---

## 4. Phase 1 — Config & Grundregeln

> **Ziel:** DKP-System auf die Gilden-Regeln vorkonfigurieren. Keine neuen Features, nur sinnvolle Defaults.

### 4.1 Config-Defaults anpassen

**Datei:** `netlify/functions/dkp.mjs`

```js
// Vorher:
const DEFAULT_CONFIG = {
  allowNegativeBalance: true,
  startingBalance: 0,
  defaultDecayPercent: 15,
  // ...
};

// Nachher:
const DEFAULT_CONFIG = {
  allowNegativeBalance: false,      // Regel: Negative DKP nicht möglich
  startingBalance: 0,               // Startbonus wird separat vergeben
  defaultDecayPercent: 50,           // Phasen-Reset = 50% Halbierung
  minBid: 5,                        // Mindestgebot
  raidAttendanceDkp: 10,            // DKP für vollständige Teilnahme
  raidPartialDkp: 5,                // DKP für verspätet/vorzeitig
  raidBenchDkp: 10,                 // DKP für Bench-Spieler
  bossKillDkp: 5,                   // DKP pro Bosskill
  startingBonus: 20,                // Einmaliger Startbonus
  // ...
};
```

### 4.2 Startbonus-Flag im Balance-Modell

**Datei:** `netlify/functions/dkp.mjs`

Das Balance-Objekt bekommt ein neues Feld:
```js
{
  playerName: "Thrallmächtig",
  className: "Schamane",
  balance: 20,
  hasReceivedStartingBonus: true,  // NEU
  lastUpdated: "2026-03-02T..."
}
```

### 4.3 Spend-Validierung: No-Negative-DKP

Bereits im Backend vorhanden (`allowNegativeBalance` Check), muss nur der Default auf `false` gesetzt werden. Frontend-seitig sollte die Beute-UI den maximal möglichen Betrag anzeigen.

### Aufwand: ~1–2 Stunden

---

## 5. Phase 2 — Raid-DKP Automation

> **Ziel:** Nach einem Raid kann der Raidleiter/Offizier mit wenigen Klicks die komplette DKP-Abrechnung durchführen: Teilnahme-DKP, Bosskill-DKP, Bench-DKP und Startbonus — alles in einer Batch-Operation.

### 5.1 Neuer Teilnahme-Status für DKP-Zwecke

Das Raid-Signup-System hat bereits Statuswerte (`accepted`, `confirmed`, `benched`, `declined`, `tentative`), aber keine DKP-relevante Unterscheidung zwischen "pünktlich" und "verspätet/vorzeitig". Es gibt zwei Ansätze:

**Ansatz A — Zusätzliche Felder im Signup** (empfohlen):
```js
// Raid-Signup erweitert um DKP-Teilnahme-Status
signup.dkpStatus = 'full' | 'partial' | null;  // full = 10 DKP, partial = 5 DKP
```

**Ansatz B — Im DKP-Abrechnungs-UI festlegen:**
Der Offizier kategorisiert Spieler direkt in der Abrechnungs-UI. Keine Raid-Datenmodell-Änderung nötig.

**Empfehlung: Ansatz B** — Die Kategorisierung passiert nur einmal am Raidende und gehört logisch zum DKP-System, nicht zum Raid-System. Das vermeidet Änderungen am Raid-Backend.

### 5.2 Backend: Neue API-Action `raid-award`

**Datei:** `netlify/functions/dkp.mjs`

Neue Action `raid-award` für die gebündelte Raid-DKP-Vergabe:

```js
// POST /api/dkp { action: 'raid-award', ... }
{
  action: 'raid-award',
  raidId: 'abc-123',              // Referenz zum Raid
  raidLabel: 'Gruul — 02.03.2026', // Für Transaction-Reason
  participants: [
    // Vom Frontend kategorisiert
    { name: 'Thrallmächtig', className: 'Schamane', status: 'full' },    // 10 DKP
    { name: 'Heiligschein',  className: 'Paladin',  status: 'partial' }, // 5 DKP
  ],
  bench: [
    // Gebankte Spieler
    { name: 'Dottqueen', className: 'Hexenmeister' },  // 10 DKP
  ],
  bossKills: 4,  // Anzahl Boss-Kills → 4 × 5 = 20 DKP pro Teilnehmer
}
```

**Backend-Logik:**

```
Für jeden Spieler in participants + bench:
  1. Falls hasReceivedStartingBonus === false:
     → +20 DKP (Transaction type: 'bonus', reason: 'Startbonus')
     → hasReceivedStartingBonus = true setzen

  2. Teilnahme-DKP:
     → 'full': +10 DKP (type: 'earn', reason: 'Raidteilnahme — {raidLabel}')
     → 'partial': +5 DKP (type: 'earn', reason: 'Teilweise Teilnahme — {raidLabel}')
     → bench: +10 DKP (type: 'earn', reason: 'Bench — {raidLabel}')

  3. Bosskill-DKP (nur participants, NICHT bench):
     → bossKills × 5 DKP (type: 'earn', reason: '{bossKills} Bosskills — {raidLabel}')

Alle Transaktionen in einer Batch-Operation.
Alle Transaktionen bekommen metadata.raidId für Rückverfolgung.
```

**Neuer Transaction-Type `bonus`:**
```js
// Transaction types erweitert:
type: 'earn' | 'spend' | 'decay' | 'adjust' | 'bonus' | 'phase-reset'
```

**Schutz gegen Doppel-Vergabe:**
- Jede Raid-Award-Batch bekommt eine eindeutige `batchId`
- Optional: Backend speichert `dkp-raid-awards` Store mit `raidId → { awarded: true, timestamp, batchId }`
- Frontend zeigt bei bereits abgerechneten Raids einen Hinweis

### 5.3 Frontend: Raid-DKP Abrechnungs-UI

**Datei:** `public/index.html`

Die bestehende `dkpAwardFromRaid(raidId)` Funktion wird ersetzt durch einen neuen **Raid-Abrechnungs-Workflow**:

#### Schritt 1: Spieler kategorisieren

Wenn der Offizier auf einem vergangenen Raid "DKP abrechnen" klickt, öffnet sich ein neuer UI-Bereich (im DKP-Tab oder als Modal) mit:

```
┌─────────────────────────────────────────────────────┐
│  DKP-Abrechnung: Gruul — 02.03.2026                │
│                                                     │
│  Bosskills: [4] (× 5 DKP = 20 DKP pro Spieler)    │
│                                                     │
│  ── Teilnehmer (10 DKP vollständig / 5 DKP teil.) ─│
│  [✓ Voll] [○ Teil] Thrallmächtig    Schamane       │
│  [✓ Voll] [○ Teil] Heiligschein     Paladin        │
│  [✓ Voll] [○ Teil] Dottkönig        Hexenmeister   │
│  ...                                                │
│                                                     │
│  ── Bank (10 DKP) ─────────────────────────────────│
│  [✓] Dottqueen        Hexenmeister                 │
│  ...                                                │
│                                                     │
│  ── Vorschau ───────────────────────────────────────│
│  8 Teilnehmer (voll) × (10 + 20) = 240 DKP        │
│  1 Teilnehmer (teil.) × (5 + 20)  = 25 DKP        │
│  1 Bank-Spieler × 10              = 10 DKP         │
│  2 Startboni × 20                 = 40 DKP         │
│  ─────────────────────────────────────────          │
│  Gesamt: 315 DKP                                   │
│                                                     │
│  [Abrechnung durchführen]                           │
└─────────────────────────────────────────────────────┘
```

#### UI-Elemente:

1. **Bosskills-Zähler**: Zahleneingabe (Standard: 0). TBC-Raids könnten vordefinierte Bosslisten haben (z.B. Gruul = 2, SSC = 6, TK = 4, BT = 9, Hyjal = 5).

2. **Teilnehmer-Liste**: Alle Raid-Signups mit Status `accepted`/`confirmed` (nicht `declined`/`benched`). Jeder Spieler hat einen Toggle:
   - **Voll** (Standard): 10 DKP Teilnahme
   - **Teilweise**: 5 DKP (verspätet oder vorzeitig)
   - **Entfernen**: Spieler aus der Abrechnung nehmen

3. **Bank-Liste**: Alle Signups mit Status `benched`. Automatisch 10 DKP.

4. **Startbonus-Hinweis**: Spieler die zum ersten Mal DKP bekommen, werden markiert ("+ 20 DKP Startbonus").

5. **Vorschau**: Live-Berechnung der DKP-Summen.

6. **Bestätigungs-Modal**: Nach Klick auf "Abrechnung durchführen" mit Zusammenfassung aller DKP-Vergaben.

#### Vordefinierte Boss-Anzahlen pro Instanz:

```js
const RAID_BOSSES = {
  'Karazhan': 11,
  'Gruuls Unterschlupf': 2,
  'Magtheridons Kammer': 1,
  'Festung der Stürme': 4,
  'Höhle des Schlangenschreins': 6,
  'Hyjal': 5,
  'Der Schwarze Tempel': 9,
  'Sonnenbrunnenplateau': 6,
  'Zul\'Aman': 6,
};
```

### 5.4 Bonus-Vergabe Ablauf (Detail)

```
dkpAwardFromRaid(raidId) →
  1. Lade Raid-Daten (Signups, Instanz)
  2. Lade DKP-Balances (für hasReceivedStartingBonus Check)
  3. Wechsle zum DKP-Tab, View = 'raid-award'
  4. Zeige Kategorisierungs-UI
  5. Offizier passt Bosskills & Spieler-Status an
  6. Vorschau wird live berechnet
  7. Offizier klickt "Abrechnung durchführen"
  8. Bestätigungs-Modal mit Zusammenfassung
  9. POST /api/dkp { action: 'raid-award', ... }
  10. Backend verarbeitet alle Awards atomar
  11. Toast: "DKP-Abrechnung abgeschlossen: 315 DKP an 10 Spieler"
  12. Zurück zur Übersicht
```

### Aufwand: ~6–8 Stunden

---

## 6. Phase 3 — Beute-Erfassung (Post-Raid Bidding)

> **Ziel:** Der Raidleiter erfasst nach dem Raid (oder während des Raids nachträglich), welcher Spieler welches Item für wie viel DKP bekommen hat. Mainspec/Offspec wird berücksichtigt.

### 6.1 Erweiterung der "Beute" UI

Die bestehende "Beute verteilen" UI wird erweitert. Statt nur einem einzelnen Spend-Formular gibt es zwei Modi:

#### Modus A: Einzelne Beute erfassen (bestehend, erweitert)

```
┌─────────────────────────────────────────────────────┐
│  Beute verteilen                                    │
│                                                     │
│  Spieler:  [Dropdown: Thrallmächtig (150 DKP)]     │
│  Item:     [Dragonspine Trophy]                     │
│  DKP-Kosten: [25]                                   │
│  Typ:      (●) Mainspec  (○) Offspec  (○) /roll    │
│                                                     │
│  ⚠ Mindestgebot: 5 DKP                             │
│  ⚠ Max. möglich: 150 DKP (aktueller Saldo)        │
│                                                     │
│  [Beute verbuchen]                                  │
└─────────────────────────────────────────────────────┘
```

**Änderungen am bestehenden Spend:**
- Neues Feld `bidType`: `mainspec` | `offspec` | `roll` | `manual`
- Validierung: `amount >= minBid (5)` und `amount <= player.balance`
- Bei `roll` wird kein DKP abgezogen (Transaction-Amount = 0, nur Log-Eintrag)
- Wowhead-Link Erkennung für Item-Namen bleibt bestehen

#### Modus B: Raid-Beute komplett erfassen (neu)

Neuer Sub-Tab oder Abschnitt, der alle Loot-Drops eines Raids auf einmal erfasst:

```
┌─────────────────────────────────────────────────────┐
│  Raid-Beute: Gruul — 02.03.2026                     │
│                                                     │
│  Item 1: [Dragonspine Trophy    ]                   │
│    Gewinner: [Thrallmächtig ▼]  DKP: [25]  MS/OS: [MS ▼]  │
│                                                     │
│  Item 2: [Pauldrons of the Fallen Champion]         │
│    Gewinner: [Heiligschein ▼]   DKP: [30]  MS/OS: [MS ▼]  │
│                                                     │
│  Item 3: [Nethervortex]                             │
│    Gewinner: [Dottqueen ▼]  (/roll — kein DKP)     │
│                                                     │
│  [+ Item hinzufügen]                                │
│                                                     │
│  ── Zusammenfassung ────────────────────────────────│
│  3 Items, 55 DKP ausgegeben                         │
│                                                     │
│  [Beute verbuchen]                                  │
└─────────────────────────────────────────────────────┘
```

### 6.2 Backend-Änderungen

**Datei:** `netlify/functions/dkp.mjs`

Neuer Action `raid-loot` für Batch-Loot-Erfassung:

```js
// POST /api/dkp { action: 'raid-loot', ... }
{
  action: 'raid-loot',
  raidId: 'abc-123',
  raidLabel: 'Gruul — 02.03.2026',
  items: [
    {
      itemName: '[Dragonspine Trophy]',
      playerName: 'Thrallmächtig',
      amount: 25,
      bidType: 'mainspec'
    },
    {
      itemName: '[Nethervortex]',
      playerName: 'Dottqueen',
      amount: 0,
      bidType: 'roll'     // kein DKP-Abzug
    }
  ]
}
```

**Bestehender `spend` Action wird erweitert:**
- Neues optionales Feld `bidType` in Transaction-Metadaten
- Neues optionales Feld `raidId` für Rückverfolgung
- Validierung: `amount >= config.minBid` (außer bei `roll`)

**Transaction-Modell erweitert:**
```js
{
  id: 'tx-...',
  playerName: 'Thrallmächtig',
  type: 'spend',
  amount: -25,
  reason: '[Dragonspine Trophy]',
  createdBy: 'Goodfell0w',
  timestamp: '...',
  metadata: {           // NEU (optional)
    bidType: 'mainspec',
    raidId: 'abc-123'
  }
}
```

### 6.3 Beute-Übersicht (Loot-History)

Neuer Sub-Tab in der DKP-Übersicht oder eigener Bereich:

```
┌─────────────────────────────────────────────────────┐
│  Letzte Beute                                       │
│                                                     │
│  [Dragonspine Trophy]  Thrallmächtig  25 DKP  MS   │
│  Gruul — 02.03.2026                                 │
│                                                     │
│  [Pauldrons of the...]  Heiligschein  30 DKP  MS   │
│  Gruul — 02.03.2026                                 │
│                                                     │
│  [Nethervortex]         Dottqueen     /roll         │
│  Gruul — 02.03.2026                                 │
└─────────────────────────────────────────────────────┘
```

Wird aus den bestehenden `spend`-Transaktionen gefiltert. Keine neue Datenquelle nötig.

### Aufwand: ~4–6 Stunden

---

## 7. Phase 4 — Phasen-Reset

> **Ziel:** Admin kann bei einem neuen Content-Phase alle DKP-Salden auf die Hälfte setzen.

### 7.1 Backend: Neue Action `phase-reset`

**Datei:** `netlify/functions/dkp.mjs`

```js
// POST /api/dkp { action: 'phase-reset', ... }
{
  action: 'phase-reset',
  phaseName: 'Phase 3 — Der Schwarze Tempel',  // Für Audit-Log
  reason: 'Content-Phase Wechsel'                // Optional
}
```

**Backend-Logik:**
```
1. Lade alle Balances
2. Für jeden Spieler mit balance > 0:
   a. neuerSaldo = FLOOR(balance / 2)
   b. Differenz = balance - neuerSaldo
   c. Speichere neuen Saldo
   d. Erstelle Transaction:
      type: 'phase-reset'
      amount: -Differenz
      reason: 'Phasen-Reset: {phaseName}'
      metadata: { phaseId: UUID, phaseName }
3. Speichere Phase-Reset-Log in neuem Store:
   dkp-phase-resets: { id, phaseName, timestamp, playersAffected, totalReduced }
```

**Idempotenz-Schutz:**
- Speichere `phaseId` in jeder Transaction
- Beim zweiten Versuch mit gleichem `phaseName` innerhalb von 24h → Warnung/Ablehnung

**Unterschied zum bestehenden Decay:**
| | Decay | Phase-Reset |
|---|-------|-------------|
| Prozent | Konfigurierbar (1–100%) | Immer 50% |
| Rundung | `Math.round()` | `Math.floor()` (spielerfreundlich) |
| Transaction-Type | `decay` | `phase-reset` |
| Häufigkeit | Beliebig oft | Pro Phase einmal |
| UI-Platzierung | Admin-Tab "Verfall" | Eigener Button, seltener genutzt |

### 7.2 Frontend: Phase-Reset UI

Eigener Bereich im "Verfall"-Tab oder als separater Admin-Button:

```
┌─────────────────────────────────────────────────────┐
│  Phasen-Reset (DKP halbieren)                       │
│                                                     │
│  ⚠ Achtung: Diese Aktion halbiert ALLE DKP-Salden.│
│  Nur bei Content-Phase-Wechsel durchführen!         │
│                                                     │
│  Phase-Name: [Phase 3 — Der Schwarze Tempel]       │
│                                                     │
│  ── Vorschau ───────────────────────────────────────│
│  Thrallmächtig: 150 → 75 DKP (-75)                 │
│  Heiligschein:  120 → 60 DKP (-60)                 │
│  Dottqueen:      45 → 22 DKP (-23)                 │
│  ...                                                │
│  Gesamt: 315 DKP → 157 DKP (-158)                  │
│                                                     │
│  [Phasen-Reset durchführen]                         │
│  (Doppelte Bestätigung erforderlich)                │
└─────────────────────────────────────────────────────┘
```

**Doppelte Bestätigung:** Nach dem Klick erscheint ein Modal: "Bist du sicher? Diese Aktion halbiert alle DKP-Salden. Bitte gib 'RESET' ein um zu bestätigen."

### Aufwand: ~2–3 Stunden

---

## 8. Phase 5 — Quality of Life & Discord

> **Ziel:** DKP-Integration mit Discord und kleinere UX-Verbesserungen.

### 8.1 Discord-DKP-Benachrichtigungen

**Datei:** `netlify/functions/discord.mjs` (erweitern)

Nach einer DKP-Abrechnung oder Beute-Vergabe wird ein Embed in den Guild-Discord-Channel gepostet:

```
┌─── Discord Embed ────────────────────────────────────┐
│  ⚔️ DKP-Abrechnung: Gruul — 02.03.2026             │
│                                                      │
│  Teilnehmer: 8 (voll), 1 (teilweise), 1 (Bank)     │
│  Bosskills: 2 × 5 DKP                               │
│  Startboni: 2 Spieler                                │
│  Gesamt vergeben: 315 DKP                            │
│                                                      │
│  📦 Beute:                                           │
│  • [Dragonspine Trophy] → Thrallmächtig (25 DKP, MS)│
│  • [Nethervortex] → Dottqueen (/roll)               │
│                                                      │
│  🏆 Top DKP: Thrallmächtig (175), Heiligschein (150) │
│  📊 Übersicht: vanillawow.netlify.app/#/dkp          │
└──────────────────────────────────────────────────────┘
```

### 8.2 DKP-Übersicht Verbesserungen

- **Attendance-Statistik**: Spalte in der Übersichts-Tabelle mit Anwesenheitsrate
- **Earned/Spent Spalten**: Zusätzliche sortierbare Spalten für Total Verdient / Total Ausgegeben
- **Loot-Tab**: Eigener Tab mit allen vergebenen Items

### 8.3 Dashboard-Integration

Auf dem Dashboard einen DKP-Widget-Bereich:
- "Dein DKP: 150" (wenn eingeloggt und im System)
- "Nächster Raid: Gruul — morgen 19:30"
- "Letzte Beute: [Dragonspine Trophy] → Thrallmächtig"

### Aufwand: ~4–6 Stunden

---

## 9. Datenmodell-Änderungen

### Balance (erweitert)

```js
{
  playerName: 'Thrallmächtig',
  className: 'Schamane',
  balance: 150,
  hasReceivedStartingBonus: true,    // NEU — Phase 1
  totalEarned: 200,                  // NEU — Phase 5 (optional, berechnet aus Transactions)
  totalSpent: 50,                    // NEU — Phase 5 (optional)
  lastUpdated: '2026-03-02T...'
}
```

### Transaction (erweitert)

```js
{
  id: 'tx-...',
  playerName: 'Thrallmächtig',
  type: 'earn' | 'spend' | 'decay' | 'adjust' | 'bonus' | 'phase-reset',  // bonus + phase-reset NEU
  amount: 10,
  reason: 'Raidteilnahme — Gruul 02.03.2026',
  createdBy: 'Goodfell0w',
  timestamp: '2026-03-02T...',
  metadata: {                   // NEU (optional JSONB-äquivalent)
    raidId: 'abc-123',          // Raid-Referenz
    batchId: 'batch-...',       // Batch-Referenz für Undo-Unterstützung
    bidType: 'mainspec',        // MS/OS/roll (nur bei spend)
    phaseId: 'phase-...',       // Phase-Referenz (nur bei phase-reset)
    category: 'attendance'      // attendance | bosskill | bench | bonus
  }
}
```

### Config (erweitert)

```js
{
  roles: { goodfell0w: 'admin' },
  allowNegativeBalance: false,       // GEÄNDERT: false statt true
  defaultDecayPercent: 50,           // GEÄNDERT: 50% für Phasen-Reset
  maxDkpAmount: 10000,
  startingBalance: 0,
  transactionLimit: 50,
  reasonMaxLength: 200,
  // NEU:
  minBid: 5,                        // Mindestgebot
  raidAttendanceDkp: 10,            // DKP Raidteilnahme (voll)
  raidPartialDkp: 5,                // DKP Raidteilnahme (teilweise)
  raidBenchDkp: 10,                 // DKP Bench
  bossKillDkp: 5,                   // DKP pro Bosskill
  startingBonus: 20,                // Einmaliger Startbonus
}
```

### Neuer Store: `dkp-raid-awards` (optional)

Für Doppel-Vergabe-Schutz und Audit:
```js
{
  raidId: 'abc-123',
  batchId: 'batch-...',
  awardedAt: '2026-03-02T...',
  awardedBy: 'Goodfell0w',
  participants: 8,
  benchPlayers: 1,
  bossKills: 2,
  totalDkpAwarded: 315,
  startingBonuses: 2
}
```

---

## 10. API-Änderungen

### Neue Actions (POST /api/dkp)

| Action | Phase | Rolle | Beschreibung |
|--------|-------|-------|-------------|
| `raid-award` | 2 | Officer+ | Batch-DKP-Vergabe für einen Raid |
| `raid-loot` | 3 | Officer+ | Batch-Loot-Erfassung für einen Raid |
| `phase-reset` | 4 | Admin | 50% Halbierung aller Salden |

### Geänderte Actions

| Action | Phase | Änderung |
|--------|-------|----------|
| `spend` | 3 | Optionale `bidType`/`raidId` Metadaten |
| `save-config` | 1 | Neue Config-Felder akzeptieren |

### GET-Erweiterungen

| Endpunkt | Phase | Änderung |
|----------|-------|----------|
| `GET /api/dkp` | 2 | `config` enthält neue Felder |
| `GET /api/dkp?loot=true` | 3 | Optional: Nur Spend-Transaktionen zurückgeben (Loot-History) |

---

## 11. Frontend-Änderungen

### Geänderte Bereiche in `public/index.html`

| Bereich | Phase | Änderung |
|---------|-------|----------|
| `renderRaidCard()` | 2 | "DKP abrechnen" Button → öffnet neuen Abrechnungs-Workflow |
| `dkpAwardFromRaid()` | 2 | Kompletter Rewrite → Kategorisierungs-UI |
| `renderDkp()` | 2 | Neuer View `raid-award` in Tab-Logik |
| `renderDkpSpend()` | 3 | MS/OS Toggle, Mindestgebot-Hinweis, Max-Balance-Anzeige |
| `renderDkpDecay()` | 4 | Phase-Reset als eigener Bereich |
| `renderDkpSettings()` | 1 | Neue Config-Felder (Raid-DKP-Werte, Mindestgebot, etc.) |
| `renderDkpOverview()` | 3 | Loot-History Abschnitt |
| CSS (DKP-Bereich) | 2–3 | Neue Styles für Kategorisierungs-Chips, Batch-Vorschau |

### Neue Frontend-Funktionen

| Funktion | Phase | Beschreibung |
|----------|-------|-------------|
| `renderRaidAward()` | 2 | Raid-DKP-Abrechnungs-UI |
| `doRaidAward()` | 2 | API-Call für `raid-award` |
| `renderBatchLoot()` | 3 | Raid-Beute-Erfassungs-UI |
| `doBatchLoot()` | 3 | API-Call für `raid-loot` |
| `doPhaseReset()` | 4 | API-Call für `phase-reset` |

### UI-Sprache (Deutsch)

Alle neuen UI-Texte:
- "DKP abrechnen" (Raid-Button)
- "Raidteilnahme" / "Teilweise Teilnahme" / "Bank"
- "Bosskills"
- "Startbonus" / "Erstmalige Teilnahme: +20 DKP"
- "Vorschau" / "Abrechnung durchführen"
- "Mainspec" / "Offspec" / "/roll"
- "Mindestgebot: 5 DKP"
- "Phasen-Reset" / "DKP halbieren"
- "Phase-Name"
- Bestätigungs-Texte für Modals

---

## 12. Test-Strategie

### Bestehende Tests (müssen weiterhin bestehen)

Alle 30+ Tests in `tests/functional/dkp.spec.js` müssen unverändert bestehen. Da die bestehende UI nur erweitert wird (keine Breaking Changes), sollte das gegeben sein.

### Neue Tests pro Phase

#### Phase 1 — Config
- Config-Defaults: `allowNegativeBalance` ist `false`
- Spend wird abgelehnt wenn Balance nicht reicht
- Neue Config-Felder werden in Settings angezeigt und gespeichert

#### Phase 2 — Raid-DKP Automation
- Raid-DKP Abrechnung: Vollständige Teilnahme → 10 DKP
- Raid-DKP Abrechnung: Teilweise Teilnahme → 5 DKP
- Raid-DKP Abrechnung: Bench → 10 DKP
- Startbonus: Erstmalig → +20 DKP, zweites Mal → kein Bonus
- Bosskills: N × 5 DKP
- Doppel-Vergabe-Schutz: Zweite Abrechnung für denselben Raid wird verhindert
- Vorschau-Berechnung stimmt mit tatsächlicher Vergabe überein
- "DKP abrechnen" Button erscheint nur auf vergangenen Raids

#### Phase 3 — Beute-Erfassung
- Einzelne Beute: MS/OS wird in Transaction-Metadaten gespeichert
- Einzelne Beute: Mindestgebot 5 DKP wird validiert
- Einzelne Beute: Kann nicht mehr als Balance ausgeben
- Batch-Loot: Mehrere Items auf einmal erfassen
- Roll-Item: Kein DKP-Abzug
- Loot-History zeigt alle Spend-Transaktionen

#### Phase 4 — Phasen-Reset
- Phase-Reset halbiert alle positiven Salden
- `FLOOR()` Rundung (11 → 5, nicht 6)
- Spieler mit 0 oder 1 DKP → bleiben bei 0
- Doppel-Reset-Schutz
- Doppelte Bestätigung im Modal

### Mock-API Erweiterungen

**Datei:** `tests/fixtures/mock-api.js`

```js
// Neue Actions im DKP-Mock:
if (action === 'raid-award') {
  // Simuliere Batch-Award mit Startbonus-Logik
}
if (action === 'raid-loot') {
  // Simuliere Batch-Loot
}
if (action === 'phase-reset') {
  // Simuliere 50% Halbierung
}
```

---

## Zusammenfassung: Implementierungsreihenfolge

```
Phase 1: Config & Grundregeln          (~1–2h)    ← Sofort machbar
  └─ Default-Werte anpassen, Startbonus-Flag, Config-Felder

Phase 2: Raid-DKP Automation           (~6–8h)    ← Höchste Priorität
  └─ raid-award API, Kategorisierungs-UI, Batch-Vergabe, Startbonus

Phase 3: Beute-Erfassung               (~4–6h)    ← Nach Phase 2
  └─ MS/OS/Roll, Mindestgebot, Batch-Loot, Loot-History

Phase 4: Phasen-Reset                  (~2–3h)    ← Kann parallel zu Phase 3
  └─ phase-reset API, Halbierung, Doppel-Schutz

Phase 5: Quality of Life & Discord     (~4–6h)    ← Nach Phase 3+4
  └─ Discord-Embeds, Dashboard-Widget, Attendance-Statistik
```

**Gesamtaufwand: ~17–25 Stunden**

### Abhängigkeiten

```
Phase 1 ──→ Phase 2 ──→ Phase 3
                    └──→ Phase 5
             Phase 4 (unabhängig, kann parallel)
```

Phase 1 ist Voraussetzung für Phase 2 (Config-Werte werden von raid-award genutzt).
Phase 2 ist Voraussetzung für Phase 3 (Raid-Loot referenziert den Raid-Kontext).
Phase 4 ist unabhängig und kann jederzeit implementiert werden.
Phase 5 setzt Phase 2+3 voraus (Discord-Embeds für Raid-Abrechnungen).
