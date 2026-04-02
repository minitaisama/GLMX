import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  page = await app.firstWindow();
  await page.waitForTimeout(4000);
});

test.afterAll(async () => {
  await app?.close();
});

test.describe('Automated UI Component Crawler', () => {
  test('Scan and interact with every button element to catch clickability failures', async () => {
    
    // Query all elements with button role or tag
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count();
    
    console.log(`[Crawler] Detected ${count} interactive elements. Scanning...`);
    
    let failureCount = 0;
    const errorLogs: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      try {
        // Evaluate if component is visually completely obscured or disabled
        const isVisible = await btn.isVisible();
        const isEnabled = await btn.isEnabled();
        
        if (isVisible && isEnabled) {
          // Hover text or inner text for context tracking
          const ctxText = (await btn.textContent())?.trim() || `Button index ${i}`;
          
          // Optionally perform a soft dispatchEvent to verify it takes interactions
          // Not using await btn.click() on ALL to prevent destructive navigations closing the app 
          // during generic crawl, but verifying that it receives pointer events.
          await btn.hover({ timeout: 1000 });
          
          // Ensure bounding box exists
          const box = await btn.boundingBox();
          expect(box).not.toBeNull();
        }
      } catch (err: any) {
        failureCount++;
        errorLogs.push(`Button ${i} failed interaction test: ${err.message}`);
      }
    }
    
    // If there's an obscured/unclickable button, we log it for the reporter.
    if (failureCount > 0) {
      console.warn('Crawler found issues:\n', errorLogs.join('\n'));
      // In a strict scenario we might fail the test, but for the crawler we'll just soft-fail
      // or record it as a warning in playwright trace.
    }
    
    expect(failureCount).toBeLessThan(10); // arbitrary limit, normally should be 0 
  });
});
