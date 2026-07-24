# muehleconnect

App zur internen Organisation der Dobelmühle. Aktuell enthalten: das **Kassensystem** für den
Verkauf bei Festen (`kassensystem/`).

**Download:** Fertige Installer für Windows (`.exe`) und Linux (`.AppImage`) — kein Programmieren
oder Bauen nötig — stehen auf der [Releases-Seite](../../releases) bereit. Einfach die passende
Datei herunterladen; die Windows-Installation läuft ohne Administratorrechte.

## Kassensystem – wie es funktioniert

Das Kassensystem läuft als App auf einem Laptop, der per USB an einen Bondrucker angeschlossen
ist. Es ist auf schnellen Verkauf an einem Stand ausgelegt (z. B. Essens-/Getränkeausgabe bei
einem Fest) und funktioniert komplett offline.

### 1. Verkauf an der Kasse

- Auf dem Startbildschirm ("Kasse") sind die Produkte nach Kategorie (z. B. Essen, Getränke) in
  großen Buttons angeordnet. Ein Klick auf einen Button legt einen Artikel in den Warenkorb, ein
  weiterer Klick erhöht die Menge. Für die neun am häufigsten verkauften Artikel einer Kategorie
  funktionieren zusätzlich die Zifferntasten 1–9 als Shortcut, damit auch ohne Maus schnell
  kassiert werden kann.
- Getränke mit Pfand (z. B. Becher) bekommen automatisch eine zusätzliche "Pfand"-Position im
  Warenkorb dazu — das muss nicht separat angeklickt werden.
- Rechts zeigt der Warenkorb alle Positionen und die laufende Summe. Ein Klick auf "Kassieren"
  öffnet das Bezahl-Fenster — dabei druckt die App sofort **für jeden Artikel im Warenkorb einen
  eigenen Wertbon** (auch für Pfand-Positionen), damit die Bons schon fertig sind, während der
  erhaltene Bargeldbetrag eingetippt wird. Diese kleinen Bons sind dafür gedacht, an der
  Essens-/Getränkeausgabe gegen die jeweilige Ware eingetauscht zu werden — wer z. B. 2× Bier und
  1× Bratwurst kauft, bekommt 3 einzelne Bons zum Abgeben. Es lassen sich zusätzlich vorgefertigte
  Scheine (5/10/20/50 €) antippen statt den Betrag einzutippen; "Passend" setzt den erhaltenen
  Betrag direkt auf die Summe. Erst nach Bestätigen wird der Verkauf gespeichert.

### 2. Was gedruckt wird

- **Wertbons**: siehe oben — werden schon beim Öffnen von "Kassieren" gedruckt, noch bevor der
  Verkauf bestätigt ist.
- **Kassenbon**: wird **nicht** automatisch mitgedruckt, sondern ist eine eigene Aktion über den
  "Bon drucken"-Knopf, der nach dem Bestätigen erscheint — z. B. falls im Einzelfall doch ein
  Gesamtbeleg mit allen Positionen, Preis, Summe und MwSt.-Aufschlüsselung gebraucht wird.

Schlägt der Wertbon-Druck beim Öffnen von "Kassieren" fehl (z. B. kein Drucker angeschlossen),
zeigt das Bezahl-Fenster das direkt an und bietet einen "Erneut drucken"-Knopf — der Verkauf lässt
sich trotzdem normal abschließen.

### 3. Produkte & Einstellungen

- Unter "Produkte" werden Artikel angelegt/bearbeitet: Name, Preis, Kategorie,
  Mehrwertsteuersatz und optional ein Pfandbetrag. Die Reihenfolge in der Liste bestimmt, wo ein
  Artikel im Kassenraster erscheint.
- Unter "Einstellungen" werden der angeschlossene USB-Drucker ausgewählt und getestet, sowie die
  Kopfzeilen des Bons (z. B. Veranstaltungsname), die Adresse der Organisation und die
  Mehrwertsteuersätze festgelegt.

### 4. Tagesabschluss

Unter "Kassen-Journal" lässt sich für einen beliebigen Tag eine Übersicht aller Verkäufe abrufen:
je Artikel verkaufte Menge und Summe, dazu die Gesamteinnahmen mit Aufschlüsselung nach
Mehrwertsteuersatz (Netto/MwSt./Brutto). Dieses Journal kann ebenfalls ausgedruckt werden, z. B.
für die Kassenabrechnung nach dem Fest.

### 5. Datensicherung

Nach jedem Verkauf legt die App automatisch eine Sicherungskopie der Kassendaten an — ohne dass
jemand etwas tun muss. Unter "Einstellungen" lässt sich zusätzlich jederzeit manuell eine Kopie
speichern (z. B. auf einen USB-Stick) sowie eine zuvor gesicherte Kopie wiederherstellen, falls der
Kassen-Laptop getauscht werden muss. Dort lassen sich außerdem alle Verkäufe als CSV/Excel/PDF
exportieren, z. B. für die Buchhaltung.

## Technisches Setup

Eine Schritt-für-Schritt-Anleitung zur Erstinstallation auf dem Kassen-Laptop (Node.js,
Installer bauen, Bondrucker per WinUSB einrichten) sowie Hinweise für Entwicklung, Build und
Tests stehen in [`kassensystem/README.md`](kassensystem/README.md).
