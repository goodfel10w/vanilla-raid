# <Vanilla> Raid-Planer — TBC

Ein Raid-Verfügbarkeitsplaner für deine WoW TBC Gilde, gehostet auf Netlify. Battle.net Login, Raidplanung, DKP-System, Discord-Integration — alles in einer App.

## Features

### Verfügbarkeit & Aufstellung
- **Eintragen**: Login über Battle.net, Charakter aus dem Account importieren, klassenspezifische Spezialisierungen wählen (z.B. Balance, Feral Tank, Resto für Druiden), Verfügbarkeit im 15-Minuten-Raster eintragen (Drag-to-Paint)
- **Aufstellung**: Alle Raider auf einen Blick mit Klassen-/Spec-Icons, Spezialisierungen und Zeitfenstern
- **Heatmap**: Visuelle Übersicht welche Slots am meisten Overlap haben — 1h-, 3h- und 4h-Raidfenster-Modi (mit Hover-Details)
- **Auswertung**: Rollenverteilung, Klassenverteilung, beste Raidzeiten mit Spielerdetails, Verfügbarkeits-Ranking

### Raidplanung
- **Raids erstellen**: TBC-Instanzen (Karazhan bis Sunwell Plateau), Datum/Uhrzeit/Max-Spieler
- **Anmeldung**: Spieler melden sich mit Charakter, Spec und Status (Angenommen/Vielleicht/Abgesagt)
- **Raidleiter-Tools**: Spec-Zuweisung pro Spieler, Fortschrittsbalken, Rollenübersicht
- **Discord-Integration**: Raid-Infos als Embed per Webhook in Discord posten

### DKP-System
- **Standard DKP mit Decay**: DKP vergeben, Loot verbuchen, wöchentlicher Decay
- **Rollen-System**: Admin- und Offizier-Rollen mit unterschiedlichen Berechtigungen
- **Item-Linking**: `[Itemname]` im Loot-Feld wird als Wowhead-Link mit Icon angezeigt
- **Raid-zu-DKP**: Vergangene Raids direkt als DKP-Vergabe übernehmen
- **Übersicht**: Sortierbare Tabelle, Spieler-Details, Transaktionshistorie, Undo, CSV-Export

### Authentifizierung
- **Battle.net OAuth SSO**: Login über Blizzard-Account — kein eigenes Passwort nötig
- **Charakter-Import**: WoW-Charaktere vom Battle.net-Profil automatisch laden (Allianz, Thunderstrike EU)
- **Eigentümer-System**: Nur eigene Einträge bearbeitbar; Legacy-Einträge können übernommen werden

## Deployment auf Netlify

### Option A: Über die Netlify UI (am einfachsten)

1. Erstelle ein GitHub/GitLab Repo und pushe diesen Ordner
2. Gehe zu [app.netlify.com](https://app.netlify.com)
3. Klicke **"Add new site" → "Import an existing project"**
4. Wähle dein Repo aus
5. Build settings werden automatisch erkannt (netlify.toml)
6. Klicke **"Deploy site"**
7. Fertig! Teile die URL mit deiner Gilde

### Option B: Über Netlify CLI

```bash
# Netlify CLI installieren
npm install -g netlify-cli

# In den Projektordner wechseln
cd vanilla-raid

# Dependencies installieren (für die Serverless Function)
npm install

# Lokal testen
netlify dev

# Deployen
netlify deploy --prod
```

### Umgebungsvariablen

Folgende Environment Variables müssen in Netlify gesetzt werden:

| Variable | Beschreibung |
|---|---|
| `BNET_CLIENT_ID` | Battle.net OAuth Client ID |
| `BNET_CLIENT_SECRET` | Battle.net OAuth Client Secret |
| `BNET_REGION` | Battle.net Region (Standard: `eu`) |
| `BNET_FACTION` | Fraktionsfilter für Charaktere (Standard: `ALLIANCE`) |
| `BNET_REALM` | Realmfilter für Charaktere (Standard: `thunderstrike`) |
| `DISCORD_WEBHOOK_URL` | Discord Webhook URL für Raid-Posts (optional) |

## Technologie

- **Frontend**: Vanilla HTML/CSS/JS (kein Framework, kein Build-Step)
- **Backend**: Netlify Functions (Serverless)
- **Datenbank**: Netlify Blobs (eingebauter Key-Value Store, kostenlos)
- **Auth**: Battle.net OAuth 2.0 (OpenID + WoW Profile Scope)
- **Icons**: [Wow-Icons](https://github.com/orourkek/Wow-Icons) via jsDelivr CDN

## Anpassungen

- **Gildenname ändern**: Im HTML nach `<Vanilla>` suchen und ersetzen
- **Realm/Fraktion ändern**: Umgebungsvariablen `BNET_REALM` und `BNET_FACTION` anpassen
- **Discord-Kanal**: `DISCORD_WEBHOOK_URL` in den Netlify-Einstellungen setzen

## Kosten

Netlify Free Tier reicht für eine Gilde locker aus:
- 125.000 Function-Aufrufe/Monat
- Unlimitierte Blobs Reads
- 100 GB Bandwidth
