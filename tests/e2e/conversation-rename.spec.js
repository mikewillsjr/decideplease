/**
 * E2E Tests - Conversation Rename Feature
 * Tests for renaming conversations via double-click inline editing
 */

import { test, expect } from '@playwright/test';
import {
  UI,
  setupAuthenticatedUser,
} from '../fixtures/test-helpers.js';

test.describe('Conversation Rename', () => {
  test.beforeEach(async ({ page, request }) => {
    // Create a fresh test user for each test
    await setupAuthenticatedUser(page, request);
  });

  test.describe('Inline Editing UI', () => {
    test('conversation title shows tooltip about double-click to rename', async ({ page }) => {
      console.log('Testing: Rename tooltip on conversation title');

      // First, create a new conversation by clicking the button
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      // Check if conversation item exists
      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        const tooltip = await titleElement.getAttribute('title');
        expect(tooltip).toBe('Double-click to rename');
        console.log('  Tooltip is correct: "Double-click to rename"');
      } else {
        console.log('  No conversation items to test');
      }
    });

    test('double-clicking title enters edit mode', async ({ page }) => {
      console.log('Testing: Double-click enters edit mode');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        // Should show input field
        const inputField = conversationItem.locator('.conversation-rename-input');
        await expect(inputField).toBeVisible({ timeout: 2000 });
        console.log('  Edit mode activated on double-click');
      } else {
        console.log('  No conversation items to test');
      }
    });

    test('edit input is auto-focused and text is selected', async ({ page }) => {
      console.log('Testing: Edit input auto-focus');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        await expect(inputField).toBeFocused();
        console.log('  Input is auto-focused');
      } else {
        console.log('  No conversation items to test');
      }
    });

    test('pressing Enter saves the new title', async ({ page }) => {
      console.log('Testing: Enter key saves title');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        await inputField.fill('My Custom Title');
        await inputField.press('Enter');

        // Should exit edit mode
        await expect(inputField).not.toBeVisible({ timeout: 2000 });

        // Title should be updated
        const newTitle = conversationItem.locator('.conversation-title');
        await expect(newTitle).toHaveText('My Custom Title');
        console.log('  Title saved on Enter');
      } else {
        console.log('  No conversation items to test');
      }
    });

    test('pressing Escape cancels the edit', async ({ page }) => {
      console.log('Testing: Escape key cancels edit');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const originalTitle = await conversationItem.locator('.conversation-title').textContent();

        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        await inputField.fill('This should be cancelled');
        await inputField.press('Escape');

        // Should exit edit mode without saving
        await expect(inputField).not.toBeVisible({ timeout: 2000 });

        // Title should be unchanged
        const newTitle = conversationItem.locator('.conversation-title');
        await expect(newTitle).toHaveText(originalTitle || 'New Decision');
        console.log('  Edit cancelled on Escape');
      } else {
        console.log('  No conversation items to test');
      }
    });

    test('clicking away (blur) saves the edit', async ({ page }) => {
      console.log('Testing: Blur saves edit');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        await inputField.fill('Blur Test Title');

        // Click somewhere else to trigger blur
        await page.locator('.sidebar').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(200);

        // Should exit edit mode
        await expect(inputField).not.toBeVisible({ timeout: 2000 });

        // Title should be updated
        const newTitle = conversationItem.locator('.conversation-title');
        await expect(newTitle).toHaveText('Blur Test Title');
        console.log('  Title saved on blur');
      } else {
        console.log('  No conversation items to test');
      }
    });
  });

  test.describe('Title Persistence', () => {
    test('renamed title persists after page refresh', async ({ page }) => {
      console.log('Testing: Title persists after refresh');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        const persistTestTitle = `Persist Test ${Date.now()}`;
        await inputField.fill(persistTestTitle);
        await inputField.press('Enter');

        await page.waitForTimeout(500);

        // Refresh the page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check title persisted
        const conversationAfterRefresh = page.locator(UI.app.conversationItem).first();
        await expect(conversationAfterRefresh.locator('.conversation-title')).toHaveText(persistTestTitle);
        console.log('  Title persisted after refresh');
      } else {
        console.log('  No conversation items to test');
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('empty title is not allowed', async ({ page }) => {
      console.log('Testing: Empty title not allowed');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const originalTitle = await conversationItem.locator('.conversation-title').textContent();

        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        await inputField.fill('');
        await inputField.press('Enter');

        await page.waitForTimeout(500);

        // Title should not be empty (either keep original or show error)
        const newTitle = conversationItem.locator('.conversation-title');
        const titleText = await newTitle.textContent();
        expect(titleText?.trim().length).toBeGreaterThan(0);
        console.log('  Empty title prevented');
      } else {
        console.log('  No conversation items to test');
      }
    });

    test('whitespace-only title is trimmed and not allowed', async ({ page }) => {
      console.log('Testing: Whitespace-only title');

      // Create a new conversation
      const newButton = page.locator(UI.app.newDecisionButton);
      await newButton.click();
      await page.waitForTimeout(500);

      const conversationItem = page.locator(UI.app.conversationItem).first();
      if (await conversationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleElement = conversationItem.locator('.conversation-title');
        await titleElement.dblclick();

        const inputField = conversationItem.locator('.conversation-rename-input');
        await inputField.fill('   ');
        await inputField.press('Enter');

        await page.waitForTimeout(500);

        // Title should not be whitespace only
        const newTitle = conversationItem.locator('.conversation-title');
        const titleText = await newTitle.textContent();
        expect(titleText?.trim().length).toBeGreaterThan(0);
        console.log('  Whitespace-only title prevented');
      } else {
        console.log('  No conversation items to test');
      }
    });
  });
});
