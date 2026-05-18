/**
 * engine.js — Adaptive Aufgaben-Engine (Üben-Modus)
 *
 * Voraussetzungen (vom HTML gesetzt):
 *   THEMA_KEY, THEMA_CONFIG, AUFGABEN
 *
 * Externe Abhängigkeit: KaTeX + auto-render (vom HTML geladen)
 *
 * Exportiert: window.BLFEngine.{start, stop, getStateSnapshot}
 */

(function () {
    'use strict';

    const LEVEL_NAMEN = {
        1: 'babyleicht',
        2: 'leicht',
        3: 'nervenschonend',
        4: 'mittel',
        5: 'anspruchsvoll',
        6: 'BLF-Niveau+'
    };

    const STORAGE_KEY_PREFIX = 'blf-engine-';

    const DEFAULT_STATE = {
        level: 3,
        streak: 0,
        wrongStreak: 0,
        answered: [],
        totalCorrect: 0,
        totalAttempts: 0
    };

    let state = null;
    let storageKey = null;
    let currentAufgabe = null;
    let feedbackShown = false;
    let container = null;
    let aufgabenList = [];
    let lastShownId = null;

    // ── State ──────────────────────────────────────────────
    function loadState() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                state = JSON.parse(raw);
                for (const k of Object.keys(DEFAULT_STATE)) {
                    if (state[k] === undefined) state[k] = DEFAULT_STATE[k];
                }
            } else {
                state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            }
        } catch (e) {
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
        // Defensiv gegen manipuliertes/altes localStorage
        if (typeof state.level !== 'number' || isNaN(state.level)) state.level = 3;
        state.level = Math.max(1, Math.min(6, Math.round(state.level)));
        if (!Array.isArray(state.answered)) state.answered = [];
    }

    function saveState() {
        try { localStorage.setItem(storageKey, JSON.stringify(state)); }
        catch (e) { /* localStorage voll/blockiert — ignorieren */ }
    }

    // ── Aufgaben-Auswahl ────────────────────────────────────
    function getNextAufgabe() {
        if (aufgabenList.length === 0) return null;

        // Springe ggf. auf das nächstkleinere existierende Level (iterativ, keine Rekursion)
        let levelTasks = aufgabenList.filter(a => a.level === state.level);
        if (levelTasks.length === 0) {
            const vorhandene = [...new Set(aufgabenList.map(a => a.level))].sort((x, y) => x - y);
            const passend = vorhandene.filter(l => l <= state.level);
            state.level = passend.length > 0 ? passend[passend.length - 1] : vorhandene[0];
            levelTasks = aufgabenList.filter(a => a.level === state.level);
        }

        let available = levelTasks.filter(a => !state.answered.includes(a.id));
        if (available.length === 0) {
            const levelIds = levelTasks.map(a => a.id);
            state.answered = state.answered.filter(id => !levelIds.includes(id));
            saveState();
            available = levelTasks;
        }
        // Direkte Wiederholung der zuletzt gezeigten Aufgabe vermeiden,
        // solange es eine Alternative gibt (z. B. nach Level-Down/Up).
        if (available.length > 1 && lastShownId !== null) {
            const ohneLetzte = available.filter(a => a.id !== lastShownId);
            if (ohneLetzte.length > 0) available = ohneLetzte;
        }
        return available[Math.floor(Math.random() * available.length)];
    }

    // ── Antwort prüfen ─────────────────────────────────────
    function validiereAntwort(aufgabe, eingabe) {
        if (aufgabe.typ === 'numerisch') {
            const cleaned = String(eingabe).replace(',', '.').trim();
            const userVal = parseFloat(cleaned);
            if (isNaN(userVal)) return false;
            const tol = aufgabe.toleranz || 0;
            return Math.abs(userVal - aufgabe.loesung) <= tol;
        }
        if (aufgabe.typ === 'mc') {
            return eingabe === aufgabe.korrekt;
        }
        return false;
    }

    function applySpiral(correct) {
        const prev = state.level;
        if (correct) {
            state.streak++;
            state.wrongStreak = 0;
            if (state.streak >= 2) {
                state.level = Math.min(6, state.level + 1);
                state.streak = 0;
            }
        } else {
            state.wrongStreak++;
            state.streak = 0;
            if (state.wrongStreak >= 2) {
                state.level = Math.max(1, state.level - 1);
                state.wrongStreak = 0;
            }
        }
        saveState();
        return {
            levelChanged: state.level !== prev,
            levelUp: state.level > prev,
            newLevel: state.level,
            prevLevel: prev
        };
    }

    // ── Render ─────────────────────────────────────────────
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

    function htmlLevelAnzeige() {
        let segs = '';
        for (let i = 1; i <= 6; i++) {
            const active = i === state.level ? ' active' : '';
            const filled = i <= state.level ? ' filled' : '';
            segs += `<div class="level-segment${active}${filled}" data-level="${i}"></div>`;
        }
        return `<div class="level-anzeige">${segs}</div>
            <div class="level-label">Level ${state.level} · ${LEVEL_NAMEN[state.level]}</div>`;
    }

    function htmlStats() {
        const falsch = state.totalAttempts - state.totalCorrect;
        return `<div class="stats-leiste">
            <span class="stat-richtig">✓ ${state.totalCorrect}</span>
            <span class="stat-falsch">✗ ${falsch}</span>
            <span class="stat-fortschritt">Aufgabe ${state.totalAttempts + 1}</span>
        </div>`;
    }

    function htmlAufgabe(aufgabe) {
        const badge = aufgabe.hilfsmittelfrei
            ? '<span class="hilfsmittelfrei-badge" title="In der BLF Teil A ohne Hilfsmittel">hilfsmittelfrei</span> '
            : '';
        let eingabe = '';
        if (aufgabe.typ === 'numerisch') {
            eingabe = `<div class="eingabe-bereich">
                <input type="text" id="antwortInput" placeholder="Deine Antwort…" autocomplete="off">
                <div><button class="btn btn-pruefen" id="btnPruefen">Prüfen</button></div>
            </div>`;
        } else if (aufgabe.typ === 'mc') {
            const labels = ['A', 'B', 'C', 'D'];
            const opts = (aufgabe.optionen || []).map((opt, i) =>
                `<button class="mc-option" data-index="${i}">${labels[i]}) ${opt}</button>`
            ).join('');
            eingabe = `<div class="mc-bereich">${opts}</div>`;
        }
        return `<div class="karte aufgabe-karte">
            <div class="aufgabe-text">${badge}${aufgabe.frage}</div>
            ${eingabe}
        </div>
        <div id="tippBox" class="tipp-box" style="display:none"></div>
        <div style="text-align:center">
            <button class="btn-tipp" id="btnTipp">💡 Tipp anzeigen</button>
        </div>
        <div id="feedback" class="feedback" style="display:none"></div>`;
    }

    function renderAufgabe(aufgabe) {
        currentAufgabe = aufgabe;
        lastShownId = aufgabe.id;
        feedbackShown = false;

        container.innerHTML = htmlLevelAnzeige() + htmlStats() + htmlAufgabe(aufgabe);
        renderMath(container);
        bindEvents();

        const input = document.getElementById('antwortInput');
        if (input) setTimeout(() => input.focus(), 30);
    }

    function bindEvents() {
        const pruefen = document.getElementById('btnPruefen');
        if (pruefen) pruefen.addEventListener('click', checkAntwort);

        document.querySelectorAll('.mc-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                selectMC(idx);
            });
        });

        const tippBtn = document.getElementById('btnTipp');
        if (tippBtn) tippBtn.addEventListener('click', zeigeTipp);

        const input = document.getElementById('antwortInput');
        if (input) {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (feedbackShown) naechsteAufgabe();
                    else checkAntwort();
                }
            });
        }
    }

    function checkAntwort() {
        if (feedbackShown || !currentAufgabe || currentAufgabe.typ !== 'numerisch') return;
        const input = document.getElementById('antwortInput');
        if (!input || input.value.trim() === '') return;
        const correct = validiereAntwort(currentAufgabe, input.value);
        verarbeiteAntwort(correct);
    }

    function selectMC(idx) {
        if (feedbackShown || !currentAufgabe || currentAufgabe.typ !== 'mc') return;
        document.querySelectorAll('.mc-option').forEach((b, i) =>
            b.classList.toggle('selected', i === idx)
        );
        const correct = validiereAntwort(currentAufgabe, idx);
        verarbeiteAntwort(correct, idx);
    }

    function verarbeiteAntwort(correct, mcIdx) {
        feedbackShown = true;
        state.totalAttempts++;
        if (correct) state.totalCorrect++;
        state.answered.push(currentAufgabe.id);
        const spiral = applySpiral(correct);

        // Eingabe sperren + markieren
        const input = document.getElementById('antwortInput');
        if (input) {
            input.disabled = true;
            input.classList.add(correct ? 'input-correct' : 'input-wrong');
        }
        const pruefen = document.getElementById('btnPruefen');
        if (pruefen) pruefen.disabled = true;

        if (currentAufgabe.typ === 'mc') {
            document.querySelectorAll('.mc-option').forEach((b, i) => {
                b.disabled = true;
                if (i === currentAufgabe.korrekt) b.classList.add('mc-correct');
                else if (i === mcIdx && !correct) b.classList.add('mc-wrong');
            });
        }

        showFeedback(correct, spiral);
        saveState();
    }

    function showFeedback(correct, spiral) {
        const fb = document.getElementById('feedback');
        if (!fb) return;
        fb.classList.add(correct ? 'richtig' : 'falsch');

        let levelHint = '';
        if (spiral.levelChanged) {
            levelHint = spiral.levelUp
                ? `<div class="level-up">🎉 Level up! → Level ${spiral.newLevel} (${LEVEL_NAMEN[spiral.newLevel]})</div>`
                : `<div class="level-down">→ Zurück zu Level ${spiral.newLevel} (${LEVEL_NAMEN[spiral.newLevel]})</div>`;
        }
        const ikon = correct
            ? '<div class="feedback-icon">✓ Richtig!</div>'
            : '<div class="feedback-icon">✗ Leider falsch.</div>';
        const lsg = currentAufgabe.loesungsweg
            ? `<div class="loesungsweg"><strong>Lösung:</strong> ${currentAufgabe.loesungsweg}</div>`
            : '';

        fb.innerHTML = `${ikon}${levelHint}${lsg}
            <div style="text-align:center"><button class="btn" id="btnWeiter">Weiter →</button></div>`;
        fb.style.display = 'block';
        renderMath(fb);

        // Level-Anzeige updaten
        const levelEl = container.querySelector('.level-anzeige');
        if (levelEl) {
            for (let i = 1; i <= 6; i++) {
                const seg = levelEl.querySelector(`[data-level="${i}"]`);
                if (!seg) continue;
                seg.classList.toggle('active', i === state.level);
                seg.classList.toggle('filled', i <= state.level);
            }
            const lbl = container.querySelector('.level-label');
            if (lbl) lbl.textContent = `Level ${state.level} · ${LEVEL_NAMEN[state.level]}`;
        }

        const weiter = document.getElementById('btnWeiter');
        if (weiter) {
            weiter.addEventListener('click', naechsteAufgabe);
            setTimeout(() => weiter.focus(), 30);
        }
        const tippBtn = document.getElementById('btnTipp');
        if (tippBtn) tippBtn.style.display = 'none';
    }

    function zeigeTipp() {
        if (!currentAufgabe || !currentAufgabe.tipp) return;
        const box = document.getElementById('tippBox');
        if (!box) return;
        box.innerHTML = `<strong>Tipp:</strong> ${currentAufgabe.tipp}`;
        box.style.display = 'block';
        renderMath(box);
        const btn = document.getElementById('btnTipp');
        if (btn) btn.style.display = 'none';
    }

    function naechsteAufgabe() {
        if (!feedbackShown) return;
        const next = getNextAufgabe();
        if (!next) {
            container.innerHTML = `<div class="karte alle-fertig">
                <h2>🏆 Alle Aufgaben geschafft!</h2>
                <p>${state.totalCorrect} von ${state.totalAttempts} richtig (${Math.round(state.totalCorrect / Math.max(state.totalAttempts, 1) * 100)}%).</p>
                <button class="btn" id="btnNochmal">Nochmal</button>
            </div>`;
            document.getElementById('btnNochmal').addEventListener('click', () => {
                state.answered = [];
                saveState();
                const a = getNextAufgabe();
                if (a) renderAufgabe(a);
            });
            return;
        }
        renderAufgabe(next);
    }

    // ── Keyboard ───────────────────────────────────────────
    function onKeydown(e) {
        const inInput = document.activeElement &&
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (inInput) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (feedbackShown) naechsteAufgabe();
            return;
        }
        if (e.key === 'ArrowRight' && feedbackShown) {
            e.preventDefault();
            naechsteAufgabe();
            return;
        }
        if ((e.key === 't' || e.key === 'T') && !feedbackShown) {
            e.preventDefault();
            zeigeTipp();
            return;
        }
        if (!feedbackShown && currentAufgabe && currentAufgabe.typ === 'mc') {
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= (currentAufgabe.optionen || []).length) {
                e.preventDefault();
                selectMC(n - 1);
            }
        }
    }

    // ── Public API ─────────────────────────────────────────
    let keyHandlerActive = false;

    function start(opts) {
        container = opts.container;
        aufgabenList = opts.aufgaben;
        storageKey = STORAGE_KEY_PREFIX + opts.themaKey;
        loadState();

        if (!keyHandlerActive) {
            document.addEventListener('keydown', onKeydown);
            keyHandlerActive = true;
        }

        const a = getNextAufgabe();
        if (a) renderAufgabe(a);
        else container.innerHTML = '<div class="karte"><p>Keine Aufgaben verfügbar.</p></div>';
    }

    function stop() {
        if (keyHandlerActive) {
            document.removeEventListener('keydown', onKeydown);
            keyHandlerActive = false;
        }
        currentAufgabe = null;
        feedbackShown = false;
    }

    function reset() {
        if (!confirm('Üben-Fortschritt für dieses Thema zurücksetzen?')) return;
        localStorage.removeItem(storageKey);
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        const a = getNextAufgabe();
        if (a) renderAufgabe(a);
    }

    function getStateSnapshot() {
        return state ? { ...state } : null;
    }

    window.BLFEngine = { start, stop, reset, getStateSnapshot };
})();
