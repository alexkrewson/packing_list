import { test, expect } from './fixtures';
import { createTrip, itemRow, openContainerMenu, openItemMenu, openPoolMenu, poolRow, section } from './helpers/actions';

test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Ctx Menu Trip');
});

test.describe('pack item context menu — mouse and matching keyboard shortcut', () => {
  test('"c" toggles checked, same as clicking Check/Uncheck', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await expect(menu.locator('#cm-toggle')).toContainText('Check');
    await localPage.keyboard.press('c');
    await expect(itemRow(localPage, 'Keys')).toHaveClass(/checked/);
    await expect(localPage.locator('.ctx-menu')).toHaveCount(0); // menu closes after the action

    const menu2 = await openItemMenu(localPage, 'Keys');
    await expect(menu2.locator('#cm-toggle')).toContainText('Uncheck');
    await localPage.keyboard.press('c');
    await expect(itemRow(localPage, 'Keys')).not.toHaveClass(/checked/);
  });

  test('"e" opens the edit-item modal', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await localPage.keyboard.press('e');
    await expect(localPage.locator('#edit-item-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#edit-item-name')).toHaveValue('Keys');
  });

  test('"r" removes the item from the trip', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await localPage.keyboard.press('r');
    await expect(itemRow(localPage, 'Keys')).toHaveCount(0);
    await expect(poolRow(localPage, 'Keys')).toBeVisible();
  });

  test('"p" opens the "waiting on" modal to set pending', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await expect(menu.locator('#cm-pending')).toContainText('Set pending');
    await localPage.keyboard.press('p');
    await expect(localPage.locator('#pending-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#pending-modal-title')).toHaveText('"Keys" is waiting on…');
  });

  test('"t" opens "Add To-Do Tasks" suggest modal', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await localPage.keyboard.press('t');
    await expect(localPage.locator('#suggest-modal')).toHaveClass(/visible/);
  });

  test('"u" turns the item into a container', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await localPage.keyboard.press('u');
    await expect(itemRow(localPage, 'Keys')).toHaveCount(0);
    await expect(section(localPage, 'Keys')).toBeVisible();
  });
});

test.describe('todo item context menu keyboard shortcuts', () => {
  test.beforeEach(async ({ localPage }) => {
    await localPage.locator('#tab-btn-todo').click();
  });

  test('"c" toggles checked', async ({ localPage }) => {
    await openItemMenu(localPage, 'Shower');
    await localPage.keyboard.press('c');
    await expect(itemRow(localPage, 'Shower')).toHaveClass(/checked/);
  });

  test('"e" opens the edit-task modal', async ({ localPage }) => {
    await openItemMenu(localPage, 'Shower');
    await localPage.keyboard.press('e');
    await expect(localPage.locator('#edit-todo-modal')).toHaveClass(/visible/);
  });

  test('"r" removes the task', async ({ localPage }) => {
    await openItemMenu(localPage, 'Shower');
    await localPage.keyboard.press('r');
    await expect(itemRow(localPage, 'Shower')).toHaveCount(0);
  });
});

test.describe('container context menu keyboard shortcuts', () => {
  test('"r" opens rename', async ({ localPage }) => {
    await openContainerMenu(localPage, 'Me');
    await localPage.keyboard.press('r');
    await expect(localPage.locator('#container-edit-title')).toHaveText('Rename Container');
  });

  test('"d" opens the delete confirmation', async ({ localPage }) => {
    await openContainerMenu(localPage, 'Me');
    await localPage.keyboard.press('d');
    await expect(localPage.locator('#confirm-delete-container-modal')).toHaveClass(/visible/);
  });
});

test.describe('pool item context menu keyboard shortcuts', () => {
  test.beforeEach(async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-remove').click();
  });

  test('"a" adds the pooled item back to the trip', async ({ localPage }) => {
    await openPoolMenu(localPage, 'Keys');
    await localPage.keyboard.press('a');
    await expect(itemRow(localPage, 'Keys')).toBeVisible();
  });

  test('"e" opens edit-item modal from the pool', async ({ localPage }) => {
    await openPoolMenu(localPage, 'Keys');
    await localPage.keyboard.press('e');
    await expect(localPage.locator('#edit-item-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#edit-item-name')).toHaveValue('Keys');
  });
});

test.describe('context menu dismissal', () => {
  test('Escape closes an open context menu', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await expect(localPage.locator('.ctx-menu')).toBeVisible();
    await localPage.keyboard.press('Escape');
    await expect(localPage.locator('.ctx-menu')).toHaveCount(0);
  });

  test('clicking outside an open context menu closes it', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await expect(localPage.locator('.ctx-menu')).toBeVisible();
    await localPage.locator('.trip-bar h1').click();
    await expect(localPage.locator('.ctx-menu')).toHaveCount(0);
  });

  test('an unmapped key does nothing and leaves the menu open', async ({ localPage }) => {
    await openItemMenu(localPage, 'Keys');
    await localPage.keyboard.press('z');
    await expect(localPage.locator('.ctx-menu')).toBeVisible();
  });
});
