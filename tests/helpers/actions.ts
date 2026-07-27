import type { Locator, Page } from '@playwright/test';

/** Creates a fresh trip via the "+ New Trip" modal and waits for it to become current. */
export async function createTrip(page: Page, name: string) {
  await page.getByRole('button', { name: '+ New Trip' }).click();
  const input = page.locator('#new-trip-name');
  await input.fill(name);
  await input.press('Enter');
  await page.locator('#new-trip-modal').waitFor({ state: 'hidden' });
}

function exact(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

/** The <li> for an active pack item or todo task, matched by its exact visible name. */
export function itemRow(page: Page, name: string): Locator {
  return page.locator('li:not(.pool-li)').filter({ has: page.locator('.item-text', { hasText: exact(name) }) });
}

/** The <li> for a pooled (inactive) item, matched by its exact visible name. */
export function poolRow(page: Page, name: string): Locator {
  return page.locator('li.pool-li').filter({ has: page.locator('.item-text', { hasText: exact(name) }) });
}

/**
 * The wrapping element for a todo category section or a pack container, by its
 * exact title. Scoped with `:scope >` so nested sub-containers don't falsely
 * match their ancestor (containers can nest; category sections can't).
 */
export function section(page: Page, title: string): Locator {
  return page.locator('.section, .category.container-node').filter({
    has: page.locator(':scope > .section-header .sec-title, :scope > .category-header .cat-title', {
      hasText: exact(title),
    }),
  });
}

/** Opens a category/container's add-item row and types+submits a new item name. */
export async function addItemInSection(page: Page, sectionTitle: string, itemName: string) {
  const sec = section(page, sectionTitle);
  await sec.locator(':scope > .section-header .add-btn, :scope > .category-header .add-btn').first().click();
  const input = sec.locator(':scope > .add-row.visible .add-input').first();
  await input.fill(itemName);
  await input.press('Enter');
}

/** Right-clicks an active item's row and returns the open context menu. */
export async function openItemMenu(page: Page, itemName: string): Promise<Locator> {
  await itemRow(page, itemName).click({ button: 'right' });
  return page.locator('.ctx-menu');
}

/** Right-clicks a container header and returns the open context menu. */
export async function openContainerMenu(page: Page, containerTitle: string): Promise<Locator> {
  await section(page, containerTitle).locator(':scope > .category-header').click({ button: 'right' });
  return page.locator('.ctx-menu');
}

/** Right-clicks a pooled item's row and returns the open context menu. */
export async function openPoolMenu(page: Page, itemName: string): Promise<Locator> {
  await poolRow(page, itemName).click({ button: 'right' });
  return page.locator('.ctx-menu');
}
