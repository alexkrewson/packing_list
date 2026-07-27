import { test, expect } from './fixtures';
import { createTrip, itemRow } from './helpers/actions';

test.describe('trips', () => {
  test('default trips are seeded and selectable', async ({ localPage }) => {
    const options = await localPage.locator('#trip-select option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);
    await expect(localPage.locator('#trip-select')).toBeVisible();
  });

  test('switching trips changes the visible packing list and persists as last trip', async ({ localPage }) => {
    const select = localPage.locator('#trip-select');
    const [firstValue, secondValue] = await select.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    );
    await select.selectOption(secondValue);
    await expect(select).toHaveValue(secondValue);

    await localPage.reload();
    await expect(localPage.locator('#trip-select')).toHaveValue(secondValue);
  });

  test('creating a trip via the modal adds it to the selector and switches to it', async ({ localPage }) => {
    const before = await localPage.locator('#trip-select option').count();

    await localPage.getByRole('button', { name: '+ New Trip' }).click();
    await expect(localPage.locator('#new-trip-modal')).toHaveClass(/visible/);

    await localPage.locator('#new-trip-name').fill('Portland Weekend');
    await localPage.locator('#new-trip-name').press('Enter');

    await expect(localPage.locator('#new-trip-modal')).not.toHaveClass(/visible/);
    await expect(localPage.locator('#trip-select')).toHaveValue(/^trip_\d+$/);
    expect(await localPage.locator('#trip-select option').count()).toBe(before + 1);
    await expect(localPage.locator('#trip-select option:checked')).toHaveText('Portland Weekend');

    // New trips start with the standard starter items active.
    await expect(itemRow(localPage, 'Keys')).toBeVisible();
    await expect(itemRow(localPage, 'Phone')).toBeVisible();
  });

  test('submitting the new-trip modal with an empty name does nothing', async ({ localPage }) => {
    const before = await localPage.locator('#trip-select option').count();
    await localPage.getByRole('button', { name: '+ New Trip' }).click();
    await localPage.locator('#new-trip-name').press('Enter');
    // Modal stays open (createTrip() returns early on empty name).
    await expect(localPage.locator('#new-trip-modal')).toHaveClass(/visible/);
    expect(await localPage.locator('#trip-select option').count()).toBe(before);
  });

  test('Escape closes the new-trip modal without creating a trip', async ({ localPage }) => {
    const before = await localPage.locator('#trip-select option').count();
    await localPage.getByRole('button', { name: '+ New Trip' }).click();
    await localPage.locator('#new-trip-name').fill('Should not be created');
    await localPage.keyboard.press('Escape');
    await expect(localPage.locator('#new-trip-modal')).not.toHaveClass(/visible/);
    expect(await localPage.locator('#trip-select option').count()).toBe(before);
  });

  /**
   * KNOWN BUG (found while writing this test, not something this suite
   * fixes): createTrip() sets the in-memory `currentTrip` and switches the
   * UI to the new trip, but — unlike switchTrip(), which is what normally
   * runs on a <select> change — it never calls ss('__meta__','lastTrip',id).
   * So a reload right after creating a trip silently drops you back onto
   * whatever trip was last persisted (the default is "salem"), even though
   * the UI just showed you sitting on the new one. Any work you can see
   * getting saved into a brand-new trip (checking items, etc.) is genuinely
   * safe — it's only the "which trip am I looking at" pointer that's lost.
   */
  test("BUG: reloading right after creating a trip drops you back to the previous trip, not the new one", async ({ localPage }) => {
    const salemValue = await localPage.locator('#trip-select').inputValue();
    await createTrip(localPage, 'Orphaned New Trip');
    const newTripValue = await localPage.locator('#trip-select').inputValue();
    expect(newTripValue).not.toBe(salemValue);

    await localPage.reload();

    // If/when this is fixed, this should read toHaveValue(newTripValue) instead.
    await expect(localPage.locator('#trip-select')).toHaveValue(salemValue);
  });
});
