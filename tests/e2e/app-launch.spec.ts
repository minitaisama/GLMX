import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close();
});

test.describe('GLMX E2E Box Check & UI Flow', () => {
  test('Check application launches and doesn\'t crash', async () => {
    // Wait for the main window to be ready
    const title = await page.title();
    expect(title).toBeDefined();
  });

  test('Verify all interactive buttons are clickable', async () => {
    // Check all buttons on the initial screen to ensure they are at least visible and enabled.
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
        const btn = buttons.nth(i);
        await expect(btn).toBeVisible();
        await expect(btn).toBeEnabled();
    }
  });
});
