/**
 * app.js — Trainer-Glue: rendert Header + Modus-Toggle und startet Engine/Cards
 *
 * Voraussetzungen (vom HTML gesetzt): THEMA_KEY, THEMA_CONFIG, AUFGABEN, KARTEN
 *
 * THEMA_CONFIG: { name, nummer, bereich }
 */

(function () {
    'use strict';

    let STORAGE_MODUS = null;
    let currentModus = null;

    function htmlTrainerKopf() {
        const startModus = localStorage.getItem(STORAGE_MODUS) || 'lernen';
        const lernenSel = startModus === 'lernen';
        return `
            <header class="trainer-header">
                <h1>${escapeHtml(THEMA_CONFIG.name)}</h1>
                <a href="../index.html" class="back-link">← Zur Übersicht</a>
            </header>
            <div class="modus-toggle" role="tablist" aria-label="Modus wählen">
                <button class="modus-btn ${lernenSel ? 'active' : ''}" data-modus="lernen"
                        role="tab" id="tab-lernen" aria-selected="${lernenSel}" aria-controls="modus-content">
                    📚 Lernen (Karten)
                </button>
                <button class="modus-btn ${!lernenSel ? 'active' : ''}" data-modus="ueben"
                        role="tab" id="tab-ueben" aria-selected="${!lernenSel}" aria-controls="modus-content">
                    🧠 Üben (Aufgaben)
                </button>
            </div>
            <div id="modus-content" role="tabpanel" aria-labelledby="${lernenSel ? 'tab-lernen' : 'tab-ueben'}"></div>
            <div style="text-align:center; margin-top: 18px">
                <button class="btn-reset" id="btnResetModus" aria-label="Fortschritt des aktuellen Modus zurücksetzen">Fortschritt dieses Modus zurücksetzen</button>
            </div>
            <div class="keyboard-hint" id="keyHint"></div>
        `;
    }

    function setModus(modus) {
        if (currentModus === modus) return;

        if (window.BLFEngine) window.BLFEngine.stop();
        if (window.BLFCards) window.BLFCards.stop();

        currentModus = modus;
        localStorage.setItem(STORAGE_MODUS, modus);

        document.querySelectorAll('.modus-btn').forEach(b => {
            const active = b.dataset.modus === modus;
            b.classList.toggle('active', active);
            b.setAttribute('aria-selected', String(active));
        });
        const panel = document.getElementById('modus-content');
        if (panel) panel.setAttribute('aria-labelledby', 'tab-' + modus);

        const content = document.getElementById('modus-content');
        const keyHint = document.getElementById('keyHint');

        if (modus === 'lernen') {
            window.BLFCards.start({
                container: content,
                karten: KARTEN,
                themaKey: THEMA_KEY
            });
            keyHint.innerHTML = '<kbd>Leer</kbd> Karte umdrehen · <kbd>1</kbd>/<kbd>W</kbd> Wiederholen · <kbd>2</kbd>/<kbd>K</kbd> Kann ich';
        } else {
            window.BLFEngine.start({
                container: content,
                aufgaben: AUFGABEN,
                themaKey: THEMA_KEY
            });
            keyHint.innerHTML = '<kbd>Enter</kbd> Prüfen / Weiter · <kbd>→</kbd> Weiter · <kbd>T</kbd> Tipp · <kbd>1</kbd>–<kbd>4</kbd> MC';
        }
    }

    function escapeHtml(text) {
        const el = document.createElement('span');
        el.textContent = text;
        return el.innerHTML;
    }

    function init() {
        const app = document.getElementById('app');
        if (!app) return;
        STORAGE_MODUS = 'blf-modus-' + THEMA_KEY;
        app.innerHTML = htmlTrainerKopf();

        document.querySelectorAll('.modus-btn').forEach(btn => {
            btn.addEventListener('click', () => setModus(btn.dataset.modus));
        });

        document.getElementById('btnResetModus').addEventListener('click', () => {
            if (currentModus === 'lernen' && window.BLFCards) window.BLFCards.reset();
            else if (currentModus === 'ueben' && window.BLFEngine) window.BLFEngine.reset();
        });

        const startModus = localStorage.getItem(STORAGE_MODUS) || 'lernen';
        setModus(startModus);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
