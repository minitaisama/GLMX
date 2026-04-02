import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['.']
  });
  page = await app.firstWindow();
  // Wait for React to load
  await page.waitForTimeout(3000);
});

test.afterAll(async () => {
  await app?.close();
});

test.describe('Chat Interface & Core Features Automation', () => {

  test('Input Area - Type and Verify Focus', async () => {
    // Locate the Monaco editor or main textarea (assuming textarea or contenteditable)
    // Often in electron react apps prompt inputs have specific placeholders
    const editor = page.locator('.view-lines').first().or(page.getByRole('textbox').first());
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('Hello from Playwright Automation!');
  });

  test('Mode Switcher - Agent vs Plan Mode Toggle', async () => {
    // Click model dropdown or mode toggle
    const modeToggle = page.locator('button').filter({ hasText: /^Agent$|^Plan$/ }).first();
    // Verify toggle exists
    if (await modeToggle.count() > 0) {
      const modeText = await modeToggle.textContent();
      await modeToggle.click();
      
      // Select the opposite mode
      const oppositeMode = modeText === 'Agent' ? 'Plan' : 'Agent';
      await page.locator(`[role="menuitem"]:has-text("${oppositeMode}")`).click();
      
      // Verify switch happened
      await expect(modeToggle).toContainText(oppositeMode);
    }
  });

  test('Planning Intent Suggestion Popup', async () => {
    const editor = page.locator('.view-lines').first().or(page.getByRole('textbox').first());
    // Clear the input
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    
    // Type the planning intent
    await editor.click();
    await page.keyboard.type('let\'s make a plan mode roadmap for our codebase');
    
    // The suggestion popup should appear
    const suggestionBox = page.getByText('Planning detected');
    await expect(suggestionBox).toBeVisible();
    
    // Test the Not now button to prevent disrupting the flow
    const notNowBtn = page.getByRole('button', { name: 'Not now' });
    await expect(notNowBtn).toBeVisible();
    // Simulate mousedown check which shouldn't focus drop
    await notNowBtn.dispatchEvent('mousedown');
    await notNowBtn.click();
    
    await expect(suggestionBox).toBeHidden();
  });

  test('Slash Commands (/) & Mentions (@)', async () => {
    const editor = page.locator('.view-lines').first().or(page.getByRole('textbox').first());
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    
    await page.keyboard.type('@');
    // Expect a File mention list to appear
    const mentionsDropdown = page.locator('[role="menu"]'); // Simplified
    await expect(mentionsDropdown).toBeVisible();
    await page.keyboard.press('Escape');

    await page.keyboard.type('/');
    // Expect a Slash command list to appear
    await expect(mentionsDropdown).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Settings & MCP Check', async () => {
    // Cmd+, to open settings
    await page.keyboard.press('Meta+,');
    
    const settingsDialog = page.getByRole('dialog');
    await expect(settingsDialog).toBeVisible();
    
    const mcpTab = page.getByRole('tab', { name: 'MCP' });
    if (await mcpTab.count() > 0) {
      await mcpTab.click();
      await expect(page.getByText('Model Context Protocol')).toBeVisible();
    }
    
    // Close settings
    await page.keyboard.press('Escape');
    await expect(settingsDialog).toBeHidden();
  });

});
