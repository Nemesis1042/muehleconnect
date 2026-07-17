# Kassensystem Dobelmühle

Schnelles Kassensystem für den Verkauf am Laptop mit USB-Bondrucker. Für jeden gekauften Artikel
wird ein eigener Wertbon gedruckt (zum Einlösen an der Essens-/Getränkeausgabe), zusätzlich ein
kombinierter Kassenbon pro Verkauf und ein druckbares Kassen-Journal als Tagesauswertung. Läuft
komplett lokal (Electron + SQLite), keine Internetverbindung nötig.

## Setup

```bash
npm install
npm run dev        # startet die App im Entwicklungsmodus
```

Bein ersten Start werden ein paar Beispielprodukte angelegt (Maultaschen, Pommes, Bier, …) —
unter "Produkte" direkt an die eigene Speisekarte anpassen.

## Bondrucker einrichten

Die App spricht den USB-Bondrucker **direkt per ESC/POS** an (kein Windows-Druckertreiber nötig).
Dafür muss der Drucker unter Windows mit dem **WinUSB**-Treiber statt seines Standardtreibers
laufen:

1. [Zadig](https://zadig.akeo.ie/) herunterladen und starten.
2. "Options" → "List All Devices", den Bondrucker in der Liste auswählen.
3. Als Treiber **WinUSB** auswählen und installieren.
4. In der App unter "Einstellungen" → "USB-Geräte suchen" den Drucker auswählen und einen
   Testdruck durchführen.

Ohne ausgewählten Drucker läuft die App im **Dry-Run-Modus**: Bons werden nicht gedruckt, aber als
Text in der Entwicklerkonsole ausgegeben — praktisch zum Testen ohne angeschlossene Hardware.

## Build & Installer

```bash
npm run build       # TypeScript-Check + electron-vite build
npm run dist:win     # Windows-Installer (electron-builder)
```

## Tests

```bash
npm test            # Vitest: Warenkorb-/Steuer-/Verkaufslogik
```
