/**
 * cards.js — Karteikarten-Engine mit Leitner-Box (Lernen-Modus)
 *
 * Voraussetzungen (vom HTML gesetzt):
 *   KARTEN: [{ id, vorderseite, rueckseite, hilfsmittelfrei? }]
 *
 * Leitner-System: 5 Boxen
 *   "kann ich"      → eine Box weiter (max 5)
 *   "wiederholen"   → zurück in Box 1
 * Auswahl: prio nach niedriger Box, dann nach längster Wartezeit.
 *
 * Exportiert: window.BLFCards.{start, stop, reset}
 */

(function () {
    'use strict';

    const STORAGE_KEY_PREFIX = 'blf-cards-';
    const MAX_BOX = 5;

    let storage = null;     // { id: { box: 1..5, lastSeen: ts } }
    let storageKey = null;
    let kartenList = [];
    let container = null;
    let currentKarte = null;
    let antwortSichtbar = false;

    function loadState() {
        try {
            const raw = localStorage.getItem(storageKey);
            storage = raw ? JSON.parse(raw) : {};
        } catch (e) {
            storage = {};
        }
        // Karten ohne Eintrag in Box 1 platzieren
        for (const k of kartenList) {
            if (!storage[k.id]) storage[k.id] = { box: 1, lastSeen: 0 };
        }
    }

    function saveState() {
        try { localStorage.setItem(storageKey, JSON.stringify(storage)); }
        catch (e) { /* ignorieren */ }
    }

    function getNextKarte() {
        // Sortiere: niedrigste Box zuerst, innerhalb Box: längste Wartezeit
        const sorted = [...kartenList].sort((a, b) => {
            const sa = storage[a.id];
            const sb = storage[b.id];
            if (sa.box !== sb.box) return sa.box - sb.box;
            return sa.lastSeen - sb.lastSeen;
        });

        if (sorted.length === 0) return null;

        // Vermeide dieselbe Karte zweimal in Folge (wenn mehr als eine Karte)
        if (currentKarte && sorted.length > 1 && sorted[0].id === currentKarte.id) {
            return sorted[1];
        }
        return sorted[0];
    }

    function boxStats() {
        const counts = [0, 0, 0, 0, 0, 0]; // Index 0 unbenutzt, 1..5
        for (const k of kartenList) {
            const b = storage[k.id]?.box || 1;
            counts[b]++;
        }
        return counts;
    }

    function htmlBoxStats() {
        const c = boxStats();
        const total = kartenList.length;
        const gemeistert = c[5];
        const html = c.slice(1).map((n, i) =>
            `<div class="box-stat">Box ${i + 1}: <strong>${n}</strong></div>`
        ).join('');
        return `<div class="karten-fortschritt">
            ${html}
            <div class="box-stat">Gemeistert: <strong>${gemeistert}/${total}</strong></div>
        </div>`;
    }

    function renderMath(el) {
        if (typeof renderMathInElement === 'function' && el) {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            });
        }
    }

    function renderKarte(karte) {
        currentKarte = karte;
        antwortSichtbar = false;

        const badge = karte.hilfsmittelfrei
            ? '<span class="hilfsmittelfrei-badge" title="In der BLF Teil A ohne Hilfsmittel">hilfsmittelfrei</span> '
            : '';
        const box = storage[karte.id].box;

        container.innerHTML = htmlBoxStats() + `
            <div class="karte">
                <div class="karte-frage">${badge}${karte.vorderseite}</div>
                <div id="karteRueckseite" style="display:none"></div>
                <div class="karte-flip-hint" id="flipHint">Klicken zum Umdrehen (oder <kbd>Leertaste</kbd>)</div>
            </div>
            <div id="bewertung" style="display:none" class="karten-bewertung">
                <button class="btn-bewertung wiederholen" data-bewertung="wiederholen">Wiederholen ↺</button>
                <button class="btn-bewertung kannich" data-bewertung="kannich">Kann ich ✓</button>
            </div>
            <div style="text-align:center; color:rgba(255,255,255,0.7); font-size:0.82rem; margin-top:10px">
                Aktuelle Box: <strong>${box}</strong> von ${MAX_BOX}
            </div>
        `;
        renderMath(container);
        bindEvents();
    }

    function bindEvents() {
        const karteEl = container.querySelector('.karte');
        if (karteEl) karteEl.addEventListener('click', toggleAntwort);

        container.querySelectorAll('.btn-bewertung').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                bewerten(btn.dataset.bewertung);
            });
        });
    }

    function toggleAntwort() {
        if (antwortSichtbar) return;
        antwortSichtbar = true;
        const rs = document.getElementById('karteRueckseite');
        if (rs) {
            rs.innerHTML = `<div class="karte-rueckseite">${currentKarte.rueckseite}</div>`;
            rs.style.display = 'block';
            renderMath(rs);
        }
        const hint = document.getElementById('flipHint');
        if (hint) hint.style.display = 'none';
        const bw = document.getElementById('bewertung');
        if (bw) bw.style.display = 'flex';
    }

    function bewerten(art) {
        const s = storage[currentKarte.id];
        s.lastSeen = Date.now();
        if (art === 'kannich') {
            s.box = Math.min(MAX_BOX, s.box + 1);
        } else {
            s.box = 1;
        }
        saveState();

        // Wenn alle Karten in Box 5 → Glückwunsch
        if (boxStats()[5] === kartenList.length) {
            container.innerHTML = `<div class="karte alle-fertig">
                <h2>🎉 Alle Karten gemeistert!</h2>
                <p>Du hast alle ${kartenList.length} Karten in Box ${MAX_BOX} gebracht.</p>
                <p style="font-size:0.92rem; color:#6b7280">Tipp: Wechsle in den Üben-Modus und teste dein Wissen an Aufgaben.</p>
                <button class="btn" id="btnNeu">Karten zurücksetzen</button>
            </div>`;
            document.getElementById('btnNeu').addEventListener('click', reset);
            return;
        }

        const next = getNextKarte();
        if (next) renderKarte(next);
    }

    // ── Keyboard ───────────────────────────────────────────
    function onKeydown(e) {
        const inInput = document.activeElement &&
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (inInput) return;

        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();  // Space würde sonst die Seite scrollen
            if (!antwortSichtbar) toggleAntwort();
            return;
        }
        if (antwortSichtbar) {
            if (e.key === '1' || e.key.toLowerCase() === 'w') {
                e.preventDefault();
                bewerten('wiederholen');
            } else if (e.key === '2' || e.key.toLowerCase() === 'k') {
                e.preventDefault();
                bewerten('kannich');
            }
        }
    }

    // ── Public API ─────────────────────────────────────────
    let keyHandlerActive = false;

    function start(opts) {
        container = opts.container;
        kartenList = opts.karten;
        storageKey = STORAGE_KEY_PREFIX + opts.themaKey;
        loadState();

        if (!keyHandlerActive) {
            document.addEventListener('keydown', onKeydown);
            keyHandlerActive = true;
        }

        if (kartenList.length === 0) {
            container.innerHTML = '<div class="karte"><p>Keine Karteikarten verfügbar.</p></div>';
            return;
        }
        const k = getNextKarte();
        if (k) renderKarte(k);
    }

    function stop() {
        if (keyHandlerActive) {
            document.removeEventListener('keydown', onKeydown);
            keyHandlerActive = false;
        }
        currentKarte = null;
        antwortSichtbar = false;
    }

    function reset() {
        if (!confirm('Karteikarten-Fortschritt für dieses Thema zurücksetzen?')) return;
        for (const k of kartenList) {
            storage[k.id] = { box: 1, lastSeen: 0 };
        }
        saveState();
        const next = getNextKarte();
        if (next) renderKarte(next);
    }

    window.BLFCards = { start, stop, reset };
})();
