import { test, expect } from './fixtures';
import { createTrip, itemRow, openItemMenu, section } from './helpers/actions';

test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Suggest Trip');
});

test.describe('add-row autocomplete', () => {
  test('a single character shows no suggestions', async ({ localPage }) => {
    const sec = section(localPage, 'Me');
    await sec.locator(':scope > .category-header .add-btn').click();
    await sec.locator(':scope > .add-row.visible .add-input').fill('S');
    await expect(sec.locator(':scope > .add-row .add-suggestions')).not.toHaveClass(/visible/);
  });

  test('typing an inactive library item name surfaces it as a clickable suggestion', async ({ localPage }) => {
    // "Sunglasses" is in the "Me" container's master library but isn't one
    // of the trip's active starter items, so it should appear as a
    // (non-"is-active") suggestion.
    const sec = section(localPage, 'Me');
    await sec.locator(':scope > .category-header .add-btn').click();
    const input = sec.locator(':scope > .add-row.visible .add-input');
    await input.fill('sungl');

    const suggestion = sec.locator('.add-sugg-item', { hasText: 'Sunglasses' });
    await expect(suggestion).toBeVisible();
    await expect(suggestion).not.toHaveClass(/is-active/);

    await suggestion.click();
    await expect(itemRow(localPage, 'Sunglasses')).toBeVisible();
  });

  test('an already-active item is shown but marked active and is not selectable', async ({ localPage }) => {
    const sec = section(localPage, 'Me');
    await sec.locator(':scope > .category-header .add-btn').click();
    const input = sec.locator(':scope > .add-row.visible .add-input');
    await input.fill('Keys');

    const suggestion = sec.locator('.add-sugg-item', { hasText: 'Keys' });
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toHaveClass(/is-active/);
  });

  test('ArrowDown + Enter selects the focused suggestion', async ({ localPage }) => {
    const sec = section(localPage, 'Me');
    await sec.locator(':scope > .category-header .add-btn').click();
    const input = sec.locator(':scope > .add-row.visible .add-input');
    await input.fill('sungl');
    await expect(sec.locator('.add-sugg-item', { hasText: 'Sunglasses' })).toBeVisible();

    await input.press('ArrowDown');
    await expect(sec.locator('.add-sugg-item.focused')).toContainText('Sunglasses');
    await input.press('Enter');

    await expect(itemRow(localPage, 'Sunglasses')).toBeVisible();
    await expect(sec.locator(':scope > .add-row')).not.toHaveClass(/visible/);
  });

  test('Escape hides the add-row without adding anything', async ({ localPage }) => {
    const sec = section(localPage, 'Me');
    await sec.locator(':scope > .category-header .add-btn').click();
    const input = sec.locator(':scope > .add-row.visible .add-input');
    await input.fill('Never Added');
    await input.press('Escape');

    await expect(sec.locator(':scope > .add-row')).not.toHaveClass(/visible/);
    await expect(itemRow(localPage, 'Never Added')).toHaveCount(0);
  });
});

test.describe('"Add To-Do Tasks" suggest modal', () => {
  test('shows AI suggestions pre-checked and adds the checked ones plus a custom task', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-todo').click();
    await expect(localPage.locator('#suggest-title')).toHaveText('To-Do Tasks for "Keys"');

    const items = localPage.locator('#suggest-list .suggest-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0).locator('input')).toBeChecked();
    await expect(items.nth(1).locator('input')).toBeChecked();
    await expect(localPage.locator('#suggest-list')).toContainText('Pack it');
    await expect(localPage.locator('#suggest-list')).toContainText('Check it works');

    await items.nth(1).locator('input').uncheck();
    await localPage.locator('#suggest-custom-input').fill('Label spare key');
    await localPage.getByRole('button', { name: 'Add Selected' }).click();

    // Submitting switches to the todo tab automatically.
    await expect(localPage.locator('#tab-btn-todo')).toHaveClass(/active/);
    await expect(itemRow(localPage, 'Pack it')).toBeVisible();
    await expect(itemRow(localPage, 'Label spare key')).toBeVisible();
    await expect(itemRow(localPage, 'Check it works')).toHaveCount(0);
  });

  test('can file suggestions under a brand-new category', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-todo').click();
    await localPage.locator('#suggest-cat-select').selectOption('__new__');
    await expect(localPage.locator('#suggest-newcat-input')).toBeVisible();
    await localPage.locator('#suggest-newcat-input').fill('Key Prep');

    await localPage.getByRole('button', { name: 'Add Selected' }).click();

    await expect(section(localPage, 'Key Prep')).toBeVisible();
  });

  test('falls back to default suggestions when the AI call fails', async ({ localPage }) => {
    // openSuggestModal()'s catch block only fires on a network-level failure
    // (fetch() doesn't reject on HTTP error statuses), so abort the request
    // rather than fulfilling with a non-2xx status.
    await localPage.route('https://api.anthropic.com/v1/messages', (route) => route.abort('failed'));

    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-todo').click();

    const items = localPage.locator('#suggest-list .suggest-item');
    await expect(items).toHaveCount(2);
    await expect(localPage.locator('#suggest-list')).toContainText('Pack Keys');
    await expect(localPage.locator('#suggest-list')).toContainText('Check Keys is working');
  });

  test('shows an empty state and still allows a custom task when there are no suggestions', async ({ localPage }) => {
    await localPage.route('https://api.anthropic.com/v1/messages', (route) =>
      route.fulfill({ status: 200, json: { content: [{ type: 'text', text: '[]' }] } }),
    );

    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-todo').click();
    await expect(localPage.locator('#suggest-list')).toContainText('No suggestions found');

    await localPage.locator('#suggest-custom-input').fill('Only this task');
    await localPage.getByRole('button', { name: 'Add Selected' }).click();

    await expect(itemRow(localPage, 'Only this task')).toBeVisible();
  });
});
