import { test, expect } from './fixtures';
import { createTrip, itemRow, openItemMenu, addItemInSection, section } from './helpers/actions';

// A fresh trip always starts with the same seven todo starter tasks (Change
// sheets / Do laundry / Vacuum / sweep in "Home"; Pack van in "Van"; Shave &
// haircut / Shower in "Personal"; Give Tilly a bath in "Tilly"), independent
// of the "salem"/"birthday" demo trips' current content.
test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Todo Test Trip');
  await localPage.locator('#tab-btn-todo').click();
});

test.describe('todo list', () => {
  test('starter tasks are active and progress reflects them', async ({ localPage }) => {
    for (const name of ['Change sheets', 'Do laundry', 'Vacuum / sweep', 'Pack van', 'Shave & haircut', 'Shower', 'Give Tilly a bath']) {
      await expect(itemRow(localPage, name)).toBeVisible();
    }
    await expect(localPage.locator('#todo-total')).toHaveText('7');
    await expect(localPage.locator('#todo-done')).toHaveText('0');
  });

  test('adding a new task via a section add-row makes it active', async ({ localPage }) => {
    await addItemInSection(localPage, 'Home', 'Water the plants');
    await expect(itemRow(localPage, 'Water the plants')).toBeVisible();
    await expect(localPage.locator('#todo-total')).toHaveText('8');
  });

  test('checking every task shows the all-done banner', async ({ localPage }) => {
    await expect(localPage.locator('#todo-all-done')).toBeHidden();
    for (const name of ['Change sheets', 'Do laundry', 'Vacuum / sweep', 'Pack van', 'Shave & haircut', 'Shower', 'Give Tilly a bath']) {
      await itemRow(localPage, name).click();
    }
    await expect(localPage.locator('#todo-done')).toHaveText('7');
    await expect(localPage.locator('#todo-all-done')).toBeVisible();
  });

  test('Reset clears all checked todo state', async ({ localPage }) => {
    await itemRow(localPage, 'Change sheets').click();
    await expect(localPage.locator('#todo-done')).toHaveText('1');
    await localPage.getByRole('button', { name: 'Reset' }).click();
    await expect(localPage.locator('#todo-done')).toHaveText('0');
  });

  test('editing a task renames it and can change its category', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Change sheets');
    await menu.locator('#ctd-edit').click();
    await expect(localPage.locator('#edit-todo-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#edit-todo-name')).toHaveValue('Change sheets');

    await localPage.locator('#edit-todo-name').fill('Change bed sheets');
    await localPage.locator('#edit-todo-cat').selectOption('__new__');
    await expect(localPage.locator('#edit-todo-newcat-field')).toBeVisible();
    await localPage.locator('#edit-todo-newcat').fill('Bedroom');
    await localPage.getByRole('button', { name: 'Save' }).click();

    await expect(localPage.locator('#edit-todo-modal')).not.toHaveClass(/visible/);
    await expect(section(localPage, 'Bedroom')).toBeVisible();
    await expect(itemRow(localPage, 'Change bed sheets')).toBeVisible();
    await expect(itemRow(localPage, 'Change sheets')).toHaveCount(0);
  });

  test('picking a highlight color on a task persists it as selected', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Shower');
    await menu.locator('#ctd-edit').click();
    const palette = localPage.locator('#edit-todo-color-palette');
    await expect(palette.locator('.color-swatch.auto')).toHaveClass(/selected/);

    const firstColor = palette.locator('.color-swatch:not(.auto)').first();
    await firstColor.click();
    await expect(firstColor).toHaveClass(/selected/);
    await expect(palette.locator('.color-swatch.auto')).not.toHaveClass(/selected/);

    await localPage.getByRole('button', { name: 'Save' }).click();

    // Reopening the edit modal should reflect the persisted color choice.
    const menu2 = await openItemMenu(localPage, 'Shower');
    await menu2.locator('#ctd-edit').click();
    await expect(localPage.locator('#edit-todo-color-palette .color-swatch:not(.auto)').first()).toHaveClass(/selected/);
  });

  test('deleting a task permanently removes it', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Shave & haircut');
    await menu.locator('#ctd-edit').click();
    await localPage.getByRole('button', { name: '🗑 Delete Permanently' }).click();
    await expect(localPage.locator('#confirm-delete-todo-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#confirm-todo-msg')).toContainText('Shave & haircut');

    await localPage.getByRole('button', { name: 'Delete from all trips' }).click();

    await expect(itemRow(localPage, 'Shave & haircut')).toHaveCount(0);
    await expect(localPage.locator('#todo-total')).toHaveText('6');
  });

  test('removing a task from the list deactivates it without deleting it from the library', async ({ localPage }) => {
    // Note: unlike the pack tab, the todo tab's #todo-pool never gets
    // populated (renderPool() is only called from renderPackTab()) — so a
    // removed task has no pool UI to re-add it from. Re-typing its exact
    // name in an add-row does still resurrect it (confirmAdd() matches
    // existing master items by name), which this test also verifies.
    const menu = await openItemMenu(localPage, 'Pack van');
    await menu.locator('#ctd-remove').click();

    await expect(itemRow(localPage, 'Pack van')).toHaveCount(0);
    await expect(localPage.locator('#todo-total')).toHaveText('6');
    // Its whole "Van" section disappears too, since a category section only
    // renders when it has at least one active item.
    await expect(section(localPage, 'Van')).toHaveCount(0);

    // Re-typing the exact name (via any section's add-row — confirmAdd()
    // matches existing master items by name, not by the section it was
    // typed into) resurrects the original item back into its own category.
    await addItemInSection(localPage, 'Home', 'Pack van');
    await expect(itemRow(localPage, 'Pack van')).toBeVisible();
    await expect(localPage.locator('#todo-total')).toHaveText('7');
    await expect(section(localPage, 'Van')).toBeVisible();
  });
});
