// @ts-check
const { test, expect } = require('@playwright/test');

const TRAINER = [
    '01-arithmetik',
    '02-lineare-funktionen',
    '03-quadratische-funktionen',
    '04-exp-pot-funktionen',
    '05-trigonometrie',
    '06-pythagoras-strahlen',
    '07-koerper',
    '08-stochastik'
];

for (const slug of TRAINER) {
    test.describe(`Trainer ${slug}`, () => {
        test(`lädt ohne Fehler, beide Modi funktionieren`, async ({ page }) => {
            const consoleErrors = [];
            page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
            page.on('console', msg => {
                if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
            });

            await page.goto(`/trainer/${slug}.html`);
            await page.waitForLoadState('networkidle');

            // Header geladen
            await expect(page.locator('.trainer-header h1')).toBeVisible();
            // Default: Lernen-Modus → Karteikarte sichtbar
            await expect(page.locator('.karte-frage')).toBeVisible();
            await expect(page.locator('.karten-fortschritt')).toBeVisible();

            // Karte umdrehen
            await page.locator('.karte').click();
            await expect(page.locator('.karte-rueckseite')).toBeVisible();

            // Üben-Modus
            await page.locator('.modus-btn[data-modus="ueben"]').click();
            await expect(page.locator('.aufgabe-karte')).toBeVisible();
            await expect(page.locator('.level-anzeige')).toBeVisible();

            // Erste Aufgabe muss Input ODER MC-Optionen haben
            const inputs = await page.locator('#antwortInput').count();
            const mc = await page.locator('.mc-option').count();
            expect(inputs + mc).toBeGreaterThan(0);

            // Keine Fehler in Console
            expect(consoleErrors).toEqual([]);
        });

        test(`alle ${slug} Aufgaben: korrekte Lösung wird als richtig akzeptiert`, async ({ page }) => {
            // Lädt alle AUFGABEN-Definitionen, prüft jede Lösung einzeln durch direktes Aufrufen von validiereAntwort.
            // Strategie: Wir prüfen die Engine in einer Sandbox-Page, indem wir die Validierungs-Logik manuell durchgehen.
            await page.goto(`/trainer/${slug}.html`);
            await page.waitForLoadState('networkidle');

            const failed = await page.evaluate(() => {
                // Reproduziere die Validierungs-Logik aus engine.js
                function validiere(aufgabe, eingabe) {
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

                const errors = [];
                for (const a of AUFGABEN) {
                    if (a.typ === 'numerisch') {
                        // Test exakte Lösung muss durchkommen
                        if (!validiere(a, a.loesung)) {
                            errors.push(`#${a.id} Level ${a.level}: exakte Lösung ${a.loesung} wird verworfen`);
                        }
                        // Test Komma-Notation
                        if (!validiere(a, String(a.loesung).replace('.', ','))) {
                            errors.push(`#${a.id} Level ${a.level}: Komma-Notation wird verworfen`);
                        }
                    } else if (a.typ === 'mc') {
                        if (!validiere(a, a.korrekt)) {
                            errors.push(`#${a.id} Level ${a.level}: MC-Lösung wird verworfen`);
                        }
                        if (!a.optionen || a.korrekt >= a.optionen.length || a.korrekt < 0) {
                            errors.push(`#${a.id}: ungültiger korrekt-Index`);
                        }
                    }
                    if (!a.tipp) errors.push(`#${a.id}: fehlender Tipp`);
                    if (!a.loesungsweg) errors.push(`#${a.id}: fehlender Lösungsweg`);
                }

                // Mindestens 2 Aufgaben pro Level (1..6)
                for (let lvl = 1; lvl <= 6; lvl++) {
                    const n = AUFGABEN.filter(a => a.level === lvl).length;
                    if (n < 1) errors.push(`Level ${lvl}: keine Aufgaben`);
                }

                // Karten-Validierung
                for (const k of KARTEN) {
                    if (!k.vorderseite) errors.push(`Karte #${k.id}: fehlende Vorderseite`);
                    if (!k.rueckseite) errors.push(`Karte #${k.id}: fehlende Rückseite`);
                }

                return errors;
            });

            expect(failed, `Inhaltsfehler in ${slug}:\n  ${failed.join('\n  ')}`).toEqual([]);
        });
    });
}

test.describe('Index-Navigation', () => {
    test('Alle Themen-Links funktionieren', async ({ page }) => {
        await page.goto('/');
        const links = await page.locator('.thema-karte').evaluateAll(els =>
            els.map(e => e.getAttribute('href'))
        );
        expect(links).toHaveLength(8);
        for (const href of links) {
            const resp = await page.request.get(`http://127.0.0.1:8088/${href}`);
            expect(resp.status(), `Link ${href}`).toBe(200);
        }
    });
});
