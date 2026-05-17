// @ts-check
const { test, expect } = require('@playwright/test');

// Schneller Sanity-Check, dass die deployed Pages-URL funktioniert.

const BASE = 'https://nachbar-blip.github.io/BLF';

test.describe('Live GitHub Pages', () => {
    test('Pages-Übersicht lädt mit allen 8 Themen', async ({ page }) => {
        const resp = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        expect(resp?.status()).toBe(200);
        await expect(page.locator('.uebersicht-header h1')).toContainText('BLF Mathe');
        await expect(page.locator('.thema-karte')).toHaveCount(8);
    });

    test('Trainer 01 (Arithmetik) lädt live', async ({ page }) => {
        const resp = await page.goto(`${BASE}/trainer/01-arithmetik.html`, { waitUntil: 'domcontentloaded' });
        expect(resp?.status()).toBe(200);
        await expect(page.locator('.trainer-header h1')).toContainText('Arithmetik');
        await expect(page.locator('.karte-frage')).toBeVisible({ timeout: 10000 });
    });
});
