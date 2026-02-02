import { test, expect } from '@playwright/test';

test.describe('TutorCat Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check if page title contains TutorCat
    await expect(page).toHaveTitle(/TutorCat/i);
  });

  test('should display header navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for header elements
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible();
  });

  test('should have login/signup links', async ({ page }) => {
    await page.goto('/');
    
    // Check for authentication links (adjust selectors based on your actual implementation)
    const loginLink = page.getByRole('link', { name: /login|sign in/i });
    await expect(loginLink).toBeVisible();
  });
});

test.describe('TutorCat Dashboard', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login or show login modal
    // Adjust based on your auth flow
    await expect(page).toHaveURL(/login|auth/i);
  });
});
