// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('BLF Mathe — Übersicht', () => {
    test('Übersicht lädt mit Header und Themenkarten', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/BLF Mathe/);
        await expect(page.locator('.uebersicht-header h1')).toContainText('BLF Mathe');
        const cards = page.locator('.thema-karte');
        await expect(cards).toHaveCount(8);
        await expect(cards.first()).toContainText('Arithmetik');
    });
});

test.describe('Thema 01 Arithmetik — Trainer', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/trainer/01-arithmetik.html');
        await page.waitForLoadState('networkidle');
    });

    test('Trainer lädt mit Header, Toggle und Default-Modus Lernen', async ({ page }) => {
        await expect(page.locator('.trainer-header h1')).toContainText('Arithmetik');
        await expect(page.locator('.modus-btn[data-modus="lernen"]')).toHaveClass(/active/);
        await expect(page.locator('.modus-btn[data-modus="ueben"]')).not.toHaveClass(/active/);
        // Im Lernen-Modus sichtbar: Karteikarten-Frage
        await expect(page.locator('.karte-frage')).toBeVisible();
        await expect(page.locator('.karten-fortschritt')).toBeVisible();
    });

    test('Karteikarte umdrehen und "Kann ich" bewerten', async ({ page }) => {
        const erstesFrage = await page.locator('.karte-frage').first().textContent();
        // Karte klicken (Umdrehen)
        await page.locator('.karte').click();
        await expect(page.locator('.karte-rueckseite')).toBeVisible();
        await expect(page.locator('.karten-bewertung')).toBeVisible();
        // "Kann ich" → nächste Karte
        await page.locator('.btn-bewertung.kannich').click();
        // Neue Karte sollte erscheinen (Frage sichtbar, keine Rückseite)
        await expect(page.locator('.karte-rueckseite')).toHaveCount(0);
        await expect(page.locator('.karte-frage')).toBeVisible();
    });

    test('Wechsel zu Üben-Modus zeigt Aufgaben mit Level-Anzeige', async ({ page }) => {
        await page.locator('.modus-btn[data-modus="ueben"]').click();
        await expect(page.locator('.modus-btn[data-modus="ueben"]')).toHaveClass(/active/);
        await expect(page.locator('.level-anzeige')).toBeVisible();
        await expect(page.locator('.stats-leiste')).toBeVisible();
        await expect(page.locator('.aufgabe-karte')).toBeVisible();
        // Sollte entweder Input oder MC-Optionen haben
        const inputs = await page.locator('#antwortInput, .mc-option').count();
        expect(inputs).toBeGreaterThan(0);
    });

    test('Numerische Aufgabe beantworten zeigt Feedback', async ({ page }) => {
        await page.locator('.modus-btn[data-modus="ueben"]').click();

        // Suche eine numerische Aufgabe (falls erste MC ist, nächste laden)
        // Im Level 3 starten Aufgaben — vermutlich numerisch (id 5). Falls MC, klick durch.
        for (let i = 0; i < 4; i++) {
            const input = page.locator('#antwortInput');
            if (await input.count() > 0) {
                await input.fill('99999');  // garantiert falsch
                await page.locator('#btnPruefen').click();
                await expect(page.locator('.feedback')).toBeVisible();
                await expect(page.locator('.feedback.falsch')).toBeVisible();
                return;
            }
            // Sonst MC: irgendeine Antwort
            await page.locator('.mc-option').first().click();
            await expect(page.locator('.feedback')).toBeVisible();
            await page.locator('#btnWeiter').click();
        }
        throw new Error('Konnte in 4 Versuchen keine Aufgabe lösen');
    });

    test('Modus-Wechsel bleibt nach Reload erhalten', async ({ page }) => {
        await page.locator('.modus-btn[data-modus="ueben"]').click();
        await expect(page.locator('.modus-btn[data-modus="ueben"]')).toHaveClass(/active/);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('.modus-btn[data-modus="ueben"]')).toHaveClass(/active/);
    });

    test('hilfsmittelfrei-Badge sichtbar auf einer Karte', async ({ page }) => {
        // Im Lernen-Modus (default) — alle Karten in Thema 01 sind hilfsmittelfrei
        await expect(page.locator('.hilfsmittelfrei-badge').first()).toBeVisible();
    });
});

test.describe('Übersicht — Fortschritt', () => {
    test('Fortschritt aus localStorage wird angezeigt', async ({ page, context }) => {
        // localStorage vorab setzen
        await context.addInitScript(() => {
            const cards = {};
            for (let i = 1; i <= 15; i++) {
                cards[i] = { box: i <= 5 ? 5 : 1, lastSeen: Date.now() };
            }
            localStorage.setItem('blf-cards-01-arithmetik', JSON.stringify(cards));
            localStorage.setItem('blf-engine-01-arithmetik', JSON.stringify({
                level: 4, streak: 0, wrongStreak: 0, answered: [1, 2, 3],
                totalCorrect: 2, totalAttempts: 3
            }));
        });
        await page.goto('/');
        const erstesThema = page.locator('.thema-karte').first();
        await expect(erstesThema).toContainText('5/15 Karten gemeistert');
        await expect(erstesThema).toContainText('Level 4');
    });
});
