import { expect, takeSnapshot, test } from '@chromatic-com/playwright';

test.describe('Visual testing', () => {
  test.describe('Static pages', () => {
    test('should take screenshot of the homepage', async ({ page }, testInfo) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', { name: 'Boilerplate Code for Your Next.js Project with Tailwind CSS' }),
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the Vietnamese homepage', async ({ page }, testInfo) => {
      await page.goto('/vi');

      await expect(
        page.getByRole('heading', { name: 'Mã khởi động cho Next.js Boilerplate với Tailwind CSS' }),
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });
  });
});
