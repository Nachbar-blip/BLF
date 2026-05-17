# BLF Mathe — Thüringen Klasse 10

Lernapp zur Vorbereitung auf die **Besondere Leistungsfeststellung (BLF) Mathematik** in Thüringen.

## Konzept

Pro Thema kannst du zwischen zwei Modi wechseln:

- **📚 Lernen (Karteikarten)** — Begriffe, Formeln und Sätze mit Leitner-Box (5 Stufen).
- **🧠 Üben (Aufgaben)** — adaptive Trainings­engine mit Level 1–6, die sich an deine Leistung anpasst.

Aufgaben, die mit dem Badge `hilfsmittelfrei` markiert sind, kommen in **Teil A** der BLF (20 BE, ohne Taschenrechner) vor. Die übrigen gehören zu **Teil B** (40 BE, mit Hilfsmitteln).

Fortschritt wird im Browser gespeichert (`localStorage`) — kein Login nötig.

## Themen

1. Arithmetik & Terme (hilfsmittelfrei-Schwerpunkt)
2. Lineare Funktionen & LGS
3. Quadratische Funktionen
4. Potenz- & Exponentialfunktionen
5. Trigonometrie
6. Pythagoras & Strahlensätze
7. Körperberechnung
8. Wahrscheinlichkeit

## Lokal starten

```bash
npm install
npm run serve
# → http://127.0.0.1:8088
```

## Tests

```bash
npx playwright install chromium  # einmalig
npm test
```

## Stack

Reines HTML/CSS/JS, KaTeX via CDN. Keine Build-Schritte, keine Frameworks.

## Quellen für Inhalte

- Lehrplan Mathematik Thüringen (Regelschule und Gymnasium, schulportal-thueringen.de)
- BLF-Originalaufgaben Thüringen (bildung-thueringen.de, schullv.de)

## Lizenz

MIT
