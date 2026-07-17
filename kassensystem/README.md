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

Benötigt wird **Node.js 20 oder neuer** (die aktuelle LTS-Version reicht). Falls schon ein älteres
Node installiert ist (z. B. Node 18), muss es zuerst aktualisiert werden — ältere Versionen
funktionieren nicht zuverlässig, siehe Hinweis unten.

[nodejs.org](https://nodejs.org/) öffnen, die **LTS-Version** herunterladen und installieren
(Windows: einfach dem Installer-Assistenten folgen, er ersetzt eine vorhandene ältere Version).
Danach Terminal/PowerShell einmal schließen und neu öffnen, und prüfen, ob es geklappt hat:

```bash
node -v
npm -v
```

`node -v` sollte `v20.x`, `v22.x` oder neuer anzeigen.

> **Warnung `npm WARN EBADENGINE ... required: { node: '20.x || 22.x ...' }` beim `npm install`?**
> Das bedeutet, die installierte Node-Version ist zu alt für `better-sqlite3`. Node wie oben
> beschrieben aktualisieren, dann im `kassensystem`-Ordner den alten `node_modules`-Ordner löschen
> und `npm install` erneut ausführen.

Beide Befehle sollten eine Versionsnummer ausgeben.

### 2. Projekt herunterladen

Entweder das Repository mit Git klonen, oder als ZIP von GitHub herunterladen und entpacken.
Danach im Terminal in den Projektordner wechseln:

```bash
cd kassensystem
npm install
```

Das lädt alle benötigten Programmbibliotheken herunter (dauert beim ersten Mal ein paar Minuten).

### 3. App bauen und installieren

**Windows:**

```bash
npm run dist:win
```

Das erzeugt im Ordner `dist/` eine Installer-Datei (`Kassensystem Dobelmühle Setup x.x.x.exe`).
Diese Datei auf dem Kassen-Laptop doppelklicken und installieren — danach ist die App über das
Startmenü aufrufbar, ganz ohne Node.js oder Terminal.

**Linux:**

```bash
npm run dist:linux
```

Das erzeugt im Ordner `dist/` eine `.AppImage`-Datei. Diese einmalig ausführbar machen und dann
starten:

```bash
chmod +x "dist/Kassensystem Dobelmühle-x.x.x.AppImage"
./dist/"Kassensystem Dobelmühle-x.x.x.AppImage"
```

*Alternative für einen schnellen ersten Test ohne Installer (beide Systeme):* `npm run dev`
startet die App direkt aus dem Projektordner heraus.

### 4. Bondrucker per USB anschließen und einrichten

Die App spricht den USB-Bondrucker **direkt per ESC/POS** an (kein normaler Druckertreiber
nötig). Wie der Zugriff freigeschaltet wird, unterscheidet sich je nach Betriebssystem:

**Windows** — der Drucker muss mit dem **WinUSB**-Treiber statt seines Standardtreibers laufen:

1. Bondrucker per USB an den Laptop anschließen.
2. [Zadig](https://zadig.akeo.ie/) herunterladen und starten.
3. Im Menü "Options" → "List All Devices" aktivieren, danach den Bondrucker in der Liste
   auswählen (meist am Hersteller-/Modellnamen erkennbar).
4. Als Ziel-Treiber **WinUSB** auswählen und auf "Install Driver" bzw. "Replace Driver" klicken.

**Linux** — kein Treiberwechsel nötig, aber ein normaler Nutzer braucht per udev-Regel Zugriff auf
das USB-Gerät (sonst meldet die App beim Drucken einen Berechtigungsfehler):

1. Bondrucker per USB anschließen, dann mit `lsusb` die Vendor-/Product-ID ablesen (Zeile wie
   `Bus 001 Device 004: ID 04b8:0202 Seiko Epson Corp. ...` → `04b8` ist die Vendor-ID, `0202` die
   Product-ID).
2. Datei `/etc/udev/rules.d/99-kassensystem-printer.rules` anlegen mit (Werte anpassen):
   ```
   SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", ATTR{idProduct}=="0202", MODE="0666", GROUP="plugdev"
   ```
3. Regel neu laden und Drucker kurz aus- und wieder einstecken:
   ```bash
   sudo udevadm control --reload-rules && sudo udevadm trigger
   ```
4. Eigenen Nutzer zur Gruppe `plugdev` hinzufügen (falls nicht schon Mitglied) und danach einmal
   ab-/anmelden: `sudo usermod -aG plugdev $USER`

**Beide Systeme:** In der Kassensystem-App unter "Einstellungen" → "USB-Geräte suchen" klicken,
den Drucker aus der Liste auswählen und mit "Testdruck" prüfen, ob ein Bon herauskommt.

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

`better-sqlite3` und `usb` sind native Module und müssen zur jeweils passenden Node-Version
kompiliert sein: `npm run dev`/`start`/`dist:*` laufen in **Electrons** Node, `npm test` läuft in
**deinem normalen** Node — zwei verschiedene ABIs. Deshalb bauen `predev`/`pretest`/`predist:*`
(automatisch vor dem jeweiligen Skript) die native Module passend neu. Das kostet ein paar
Sekunden bei jedem Wechsel zwischen `npm run dev` und `npm test`, verhindert aber Fehler wie
`NODE_MODULE_VERSION ... requires ...` oder `Module did not self-register`.

## Build & Installer

```bash
npm run build         # TypeScript-Check + electron-vite build
npm run dist:win      # Windows-Installer (electron-builder)
npm run dist:linux    # Linux AppImage (electron-builder)
```
