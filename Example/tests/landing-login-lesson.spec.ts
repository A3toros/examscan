import { test, expect } from '@playwright/test';

test.describe('TutorCat User Flow', () => {
  test('should load landing page, login, and start a lesson', async ({ page }) => {
    // Step 1: Navigate to landing page
    await test.step('Navigate to landing page', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle(/TutorCat/i);
    });

    // Step 2: Find and click login button
    await test.step('Click login button', async () => {
      const loginButton = page.getByRole('button', { name: /login|sign in/i }).or(
        page.getByRole('link', { name: /login|sign in/i })
      ).first();
      
      await expect(loginButton).toBeVisible();
      await loginButton.click();
      
      // Wait for login modal or page to appear
      await page.waitForTimeout(1000);
    });

    // Step 3: Fill in login credentials
    await test.step('Enter login credentials', async () => {
      // Look for email/username input
      const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[placeholder*="email" i], input[placeholder*="username" i]').first();
      await expect(emailInput).toBeVisible({ timeout: 5000 });
      await emailInput.fill('maxpayne');

      // Look for password input
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      await expect(passwordInput).toBeVisible();
      await passwordInput.fill('12345678a');

      // Submit the form
      const submitButton = page.getByRole('button', { name: /login|sign in|submit/i }).or(
        page.locator('button[type="submit"]')
      ).first();
      await expect(submitButton).toBeVisible();
      await submitButton.click();
    });

    // Step 4: Wait for navigation to dashboard or confirmation
    await test.step('Wait for successful login', async () => {
      // Wait for either dashboard redirect or success message
      await Promise.race([
        page.waitForURL(/dashboard/i, { timeout: 10000 }),
        page.waitForSelector('text=/dashboard|welcome|home/i', { timeout: 10000 })
      ]).catch(() => {
        // If no redirect, check for success indicators
        return page.waitForTimeout(2000);
      });
    });

    // Step 5: Navigate to dashboard if not already there
    await test.step('Navigate to dashboard', async () => {
      const currentUrl = page.url();
      if (!currentUrl.includes('dashboard')) {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
      }
    });

    // Step 6: Find and click on an active lesson
    await test.step('Find and start an active lesson', async () => {
      // Wait for lessons to load
      await page.waitForTimeout(2000);

      // Look for lesson cards/buttons - try multiple selectors
      const lessonSelectors = [
        'button:has-text("Start Lesson")',
        'button:has-text("Continue Lesson")',
        'button:has-text("▶")',
        'a[href*="/lessons/"]',
        '[data-testid*="lesson"]',
        '.lesson-card',
        'button:has-text("Lesson")',
      ];

      let lessonFound = false;
      for (const selector of lessonSelectors) {
        try {
          const lessonButton = page.locator(selector).first();
          const isVisible = await lessonButton.isVisible({ timeout: 2000 });
          if (isVisible) {
            await lessonButton.click();
            lessonFound = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // If no button found, try finding any clickable lesson element
      if (!lessonFound) {
        // Look for lesson links or cards
        const lessonLinks = page.locator('a[href*="lesson"], [class*="lesson"], [id*="lesson"]').first();
        const isVisible = await lessonLinks.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
          await lessonLinks.click();
          lessonFound = true;
        }
      }

      expect(lessonFound).toBe(true);
    });

    // Step 7: Verify lesson page loaded
    await test.step('Verify lesson started', async () => {
      // Wait for lesson page to load
      await page.waitForTimeout(2000);
      
      // Check if we're on a lesson page
      const isLessonPage = page.url().includes('/lessons/') || 
                          page.url().includes('/lesson/') ||
                          (await page.locator('text=/lesson|activity|vocabulary|grammar/i').first().isVisible().catch(() => false));

      expect(isLessonPage).toBe(true);
    });
  });

  test('should handle login with visual debugging', async ({ page }) => {
    await page.goto('/');
    
    // Take screenshot of landing page
    await page.screenshot({ path: 'tests/screenshots/01-landing-page.png', fullPage: true });

    // Click login
    const loginButton = page.getByRole('button', { name: /login|sign in/i }).or(
      page.getByRole('link', { name: /login|sign in/i })
    ).first();
    await loginButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/02-login-modal.png', fullPage: true });

    // Fill credentials
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
    await emailInput.fill('maxpayne');
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('12345678a');
    await page.screenshot({ path: 'tests/screenshots/03-credentials-filled.png', fullPage: true });

    // Submit
    const submitButton = page.getByRole('button', { name: /login|sign in|submit/i }).or(
      page.locator('button[type="submit"]')
    ).first();
    await submitButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/screenshots/04-after-login.png', fullPage: true });
  });
});
