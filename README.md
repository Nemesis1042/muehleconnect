# muehleconnect

App zur internen Organisation der Dobelmühle. Aktuell enthalten: das **Kassensystem** für den
Verkauf bei Festen (`kassensystem/`).

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
  öffnet ein Zahlenfeld: Der erhaltene Bargeldbetrag wird eingetippt, das Wechselgeld wird
  automatisch berechnet und angezeigt. Erst nach Bestätigen wird der Verkauf abgeschlossen.

### 2. Was gedruckt wird

Nach dem Bestätigen druckt die App automatisch:

1. **Einen Kassenbon** für den gesamten Einkauf: alle Positionen mit Preis, Gesamtsumme und
   Aufschlüsselung der Mehrwertsteuer.
2. **Für jeden gekauften Artikel einen eigenen Wertbon** (auch für Pfand-Positionen). Diese
   kleinen Bons sind dafür gedacht, an der Essens-/Getränkeausgabe gegen die jeweilige Ware
   eingetauscht zu werden — wer z. B. 2× Bier und 1× Bratwurst kauft, bekommt 3 einzelne Bons zum
   Abgeben plus den einen Kassenbon als Beleg.

Ist gerade kein Drucker angeschlossen bzw. eingerichtet, meldet die App das nach dem Kassieren und
bietet einen "Erneut drucken"-Knopf an — der Verkauf selbst geht dabei nicht verloren.

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

## Technisches Setup

Eine Schritt-für-Schritt-Anleitung zur Erstinstallation auf dem Kassen-Laptop (Node.js,
Installer bauen, Bondrucker per WinUSB einrichten) sowie Hinweise für Entwicklung, Build und
Tests stehen in [`kassensystem/README.md`](kassensystem/README.md).
