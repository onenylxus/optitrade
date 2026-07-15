import { expect, test } from '@playwright/test';

/**
 * Drag a widget from the drawer onto the canvas grid.
 * Finds the source by looking at ALL draggable elements on the page (drawer-first).
 * The drawer item's dragstart handler sets externalDraggedWidgetType as a
 * React prop fallback for the drop handler.
 */
async function dragFromDrawer(
  page: import('@playwright/test').Page,
  label: string,
  widgetType: string,
  targetCol: number,
  targetRow: number,
) {
  await page.evaluate(
    async ({ label, widgetType, targetCol, targetRow }) => {
      const DRAWER_MIME = 'application/x-optitrade-widget';

      const source = Array.from(document.querySelectorAll<HTMLElement>('div[draggable]')).find(
        (el) => el.textContent?.includes(label),
      );
      const grid = document.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      if (!source || !grid) throw new Error(`Drawer item "${label}" or grid not found`);

      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const pitchX = 8 * rem + 0.5 * rem;
      const pitchY = 8 * rem + 0.5 * rem;
      const rect = grid.getBoundingClientRect();
      const clientX = rect.left + targetCol * pitchX + 4 * rem;
      const clientY = rect.top + targetRow * pitchY + 4 * rem;

      const dt = new DataTransfer();
      dt.setData(DRAWER_MIME, widgetType);
      dt.setData('text/plain', widgetType);

      source.dispatchEvent(
        new DragEvent('dragstart', {
          dataTransfer: dt, bubbles: true, cancelable: true, clientX: 0, clientY: 0,
        }),
      );
      await wait(300);
      grid.dispatchEvent(
        new DragEvent('dragover', {
          dataTransfer: dt, bubbles: true, cancelable: true, clientX, clientY,
        }),
      );
      await wait(200);
      grid.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt, bubbles: true, cancelable: true, clientX, clientY,
        }),
      );
      await wait(200);
      source.dispatchEvent(
        new DragEvent('dragend', { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      await wait(200);
    },
    { label, widgetType, targetCol, targetRow },
  );
}

/**
 * Drag an existing canvas widget to a new grid cell.
 * Only searches for the source draggable element INSIDE a grid placement
 * (a child of div[style*="grid-column"]), so it never mistakenly picks up
 * the identically-labelled entry in the widget drawer.
 *
 * The canvas dragstart handler (onDragStartFromCell) calls
 * setDraggedWidget({ widgetType, sourceWidgetId, pickupOffsetPx }),
 * which provides the internal state fallback used by the dragover/drop
 * handlers to distinguish a move from an add.
 */
async function dragExistingWidget(
  page: import('@playwright/test').Page,
  widgetLabel: string,
  widgetType: string,
  targetCol: number,
  targetRow: number,
) {
  await page.evaluate(
    async ({ widgetLabel, widgetType, targetCol, targetRow }) => {
      const DRAWER_MIME = 'application/x-optitrade-widget';

      const grid = document.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      if (!grid) throw new Error('Grid not found');

      // Scope the query to children of the grid only — excludes drawer items.
      const source = Array.from(grid.querySelectorAll<HTMLElement>('div[draggable]')).find(
        (el) => el.textContent?.includes(widgetLabel),
      );
      if (!source) throw new Error(`Canvas widget "${widgetLabel}" not found`);

      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const pitchX = 8 * rem + 0.5 * rem; 
      const pitchY = 8 * rem + 0.5 * rem;
      const rect = grid.getBoundingClientRect();
      const clientX = rect.left + targetCol * pitchX + 4 * rem;
      const clientY = rect.top + targetRow * pitchY + 4 * rem;

      const dt = new DataTransfer();
      dt.setData(DRAWER_MIME, widgetType);
      dt.setData('text/plain', widgetType);

      source.dispatchEvent(
        new DragEvent('dragstart', {
          dataTransfer: dt, bubbles: true, cancelable: true, clientX: 0, clientY: 0,
        }),
      );
      await wait(300);
      grid.dispatchEvent(
        new DragEvent('dragover', {
          dataTransfer: dt, bubbles: true, cancelable: true, clientX, clientY,
        }),
      );
      await wait(200);
      grid.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt, bubbles: true, cancelable: true, clientX, clientY,
        }),
      );
      await wait(200);
      source.dispatchEvent(
        new DragEvent('dragend', { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      await wait(200);
    },
    { widgetLabel, widgetType, targetCol, targetRow },
  );
}

async function getWidgetCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector('[style*="grid-template-columns"]');
    if (!grid) return 0;
    return Array.from(grid.children).filter((child) => {
      const el = child as HTMLElement;
      return !!el.style.gridColumn && !el.classList.contains('pointer-events-none');
    }).length;
  });
}

test.describe('widget canvas interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toggles edit mode and reveals the widget library drawer', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Edit Layout' })).toBeVisible();
    await expect(page.getByText('OptiTrade')).toBeVisible();

    await page.getByRole('button', { name: 'Edit Layout' }).click();
    await expect(page.getByRole('button', { name: 'Editing' })).toBeVisible();
    await expect(page.getByText('Widget Library').first()).toBeVisible();

    await page.getByRole('button', { name: 'Editing' }).click();
    await expect(page.getByRole('button', { name: 'Edit Layout' })).toBeVisible();
  });

  test('adds a daily-prediction widget from the drawer to the canvas', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Layout' }).click();

    await expect(page.getByText('Widget Library').first()).toBeVisible();
    const before = await getWidgetCount(page);

    // Hover the drawer to expose widget items
    await page.locator('aside').first().hover();

    await dragFromDrawer(page, 'Daily Market Prediction', 'daily-prediction', 0, 8);

    const after = await getWidgetCount(page);
    expect(after).toBe(before + 1);
  });

  test('removes a widget via the actions menu delete option', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Layout' }).click();

    const before = await getWidgetCount(page);
    expect(before).toBeGreaterThan(0);

    // Open the kebab menu on the first widget
    await page.getByRole('button', { name: 'Widget actions' }).first().click();

    // Click the "Delete" menu item (rendered in a Radix portal)
    await page.getByRole('menuitem').filter({ hasText: 'Delete' }).click();

    // Wait for React to re-render after removal
    await page.waitForTimeout(500);
    const after = await getWidgetCount(page);
    expect(after).toBe(before - 1);
  });

  test('relocates an existing widget to a different grid position', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Layout' }).click();

    const before = await getWidgetCount(page);
    expect(before).toBeGreaterThanOrEqual(2);

    // Drag the existing candlestick widget to a free cell on the right.
    // The widget's CardTitle renders "Stock chart" (from widget-renderer.tsx),
    // which differs from the drawer label "Candlestick Chart".
    await dragExistingWidget(page, 'Stock chart', 'candlestick', 8, 6);

    const after = await getWidgetCount(page);
    expect(after).toBe(before);
  });
});
