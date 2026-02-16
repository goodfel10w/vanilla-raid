# <Vanilla> Raid-Planer — TBC

Ein einfacher Raid-Verfügbarkeitsplaner für deine WoW TBC Gilde, gehostet auf Netlify.

## Features

- **Eintragen**: Charaktername, Klasse (TBC), Rolle(n) mit Mehrfachauswahl, Wochenverfügbarkeit (Wochenende mit Nachmittags-Slots)
- **Aufstellung**: Alle Raider auf einen Blick mit Klasse, Rollen und Zeiten
- **Heatmap**: Visuelle Übersicht welche Slots am meisten Overlap haben (mit Hover-Details)
- **Auswertung**: Rollenverteilung, Klassenverteilung, beste Raidzeiten mit Spielerdetails, Verfügbarkeits-Ranking

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

## Technologie

- **Frontend**: Vanilla HTML/CSS/JS (kein Framework, kein Build-Step)
- **Backend**: Netlify Functions (Serverless)
- **Datenbank**: Netlify Blobs (eingebauter Key-Value Store, kostenlos)

## Anpassungen

- **Zeitslots ändern**: In `public/index.html` die Arrays `EVE` (Abend) und `WEX` (Wochenend-Extra) anpassen
- **Klassen ändern**: Array `CLS` in `public/index.html` bearbeiten
- **Gildenname ändern**: Im HTML nach `<Vanilla>` suchen und ersetzen

## Kosten

Netlify Free Tier reicht für eine Gilde locker aus:
- 125.000 Function-Aufrufe/Monat
- Unlimitierte Blobs Reads
- 100 GB Bandwidth
