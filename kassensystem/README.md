# Kassensystem Dobelmühle

Schnelles Kassensystem für den Verkauf am Laptop mit USB-Bondrucker. Für jeden gekauften Artikel
wird ein eigener Wertbon gedruckt (zum Einlösen an der Essens-/Getränkeausgabe), zusätzlich ein
kombinierter Kassenbon pro Verkauf und ein druckbares Kassen-Journal als Tagesauswertung. Läuft
komplett lokal (Electron + SQLite), keine Internetverbindung nötig.

Eine Beschreibung, wie sich das System im Alltag bedienen lässt, steht in der
[Projekt-README](../README.md). Diese Datei hier erklärt die technische Einrichtung.

## Erstinstallation auf dem Kassen-Laptop

Diese Schritte einmalig auf dem Laptop durchführen, der später an der Kasse steht.

### 1. Node.js installieren

Falls noch nicht vorhanden: [nodejs.org](https://nodejs.org/) öffnen, die **LTS-Version**
herunterladen und installieren (Windows: einfach dem Installer-Assistenten folgen). Danach in
einer Eingabeaufforderung/PowerShell prüfen, ob es funktioniert hat:

```bash
node -v
npm -v
```

Beide Befehle sollten eine Versionsnummer ausgeben.

### 2. Projekt herunterladen

Entweder das Repository mit Git klonen, oder als ZIP von GitHub herunterladen und entpacken.
Danach im Terminal in den Projektordner wechseln:

```bash
cd kassensystem
npm install
```

Das lädt alle benötigten Programmbibliotheken herunter (dauert beim ersten Mal ein paar Minuten).

### 3. Windows-Installer bauen und installieren

```bash
npm run dist:win
```

Das erzeugt im Ordner `dist/` eine Installer-Datei (`Kassensystem Dobelmühle Setup x.x.x.exe`).
Diese Datei auf dem Kassen-Laptop doppelklicken und installieren — danach ist die App über das
Startmenü aufrufbar, ganz ohne Node.js oder Terminal.

*Alternative für einen schnellen ersten Test ohne Installer:* `npm run dev` startet die App direkt
aus dem Projektordner heraus.

### 4. Bondrucker per USB anschließen und einrichten

Die App spricht den USB-Bondrucker **direkt per ESC/POS** an (kein normaler
Windows-Druckertreiber nötig). Dafür muss der Drucker einmalig mit dem **WinUSB**-Treiber statt
seines Standardtreibers laufen:

1. Bondrucker per USB an den Laptop anschließen.
2. [Zadig](https://zadig.akeo.ie/) herunterladen und starten.
3. Im Menü "Options" → "List All Devices" aktivieren, danach den Bondrucker in der Liste
   auswählen (meist am Hersteller-/Modellnamen erkennbar).
4. Als Ziel-Treiber **WinUSB** auswählen und auf "Install Driver" bzw. "Replace Driver" klicken.
5. In der Kassensystem-App unter "Einstellungen" → "USB-Geräte suchen" klicken, den Drucker aus
   der Liste auswählen und mit "Testdruck" prüfen, ob ein Bon herauskommt.

Ohne ausgewählten Drucker läuft die App im **Dry-Run-Modus**: Bons werden nicht gedruckt, sondern
nur als Text protokolliert — praktisch, um die App schon mal ohne angeschlossenen Drucker
auszuprobieren.

### 5. Erste Produkte anlegen

Beim allerersten Start sind bereits ein paar Beispielprodukte angelegt (Maultaschen, Pommes,
Bier, …). Unter "Produkte" auf die eigene Speisekarte anpassen: Namen, Preise, Kategorien,
Mehrwertsteuersatz und ggf. Pfandbeträge eintragen, nicht benötigte Beispielprodukte löschen.

Unter "Einstellungen" außerdem Kopfzeile (z. B. Veranstaltungsname), Adresse der Organisation und
Kassennummer eintragen — diese Angaben erscheinen auf jedem Bon.

Damit ist die Kasse einsatzbereit.

## Entwicklung

```bash
npm install
npm run dev          # startet die App im Entwicklungsmodus mit Hot-Reload
npm run typecheck    # nur TypeScript prüfen
npm test             # Vitest: Warenkorb-/Steuer-/Verkaufslogik
```

## Build & Installer

```bash
npm run build         # TypeScript-Check + electron-vite build
npm run dist:win      # Windows-Installer (electron-builder)
```
