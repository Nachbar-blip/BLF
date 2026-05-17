// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 20000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:8088',
        headless: true,
        viewport: { width: 1280, height: 800 },
        actionTimeout: 5000,
        navigationTimeout: 10000
    },
    webServer: {
        command: 'npx http-server -p 8088 -c-1 --silent',
        url: 'http://127.0.0.1:8088',
        reuseExistingServer: true,
        timeout: 30000
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' }
        }
    ]
});
