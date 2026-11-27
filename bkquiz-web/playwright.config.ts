import type { ChromaticConfig } from '@chromatic-com/playwright';
import { defineConfig, devices } from '@playwright/test';

// Cổng riêng cho e2e (mặc định 3300) — tránh dùng nhầm dev server ở cổng 3000 đang nối với database thật
const PORT = process.env.E2E_PORT || 3300;

// Database riêng cho e2e (Postgres Docker, xem docker-compose.yml). `prisma migrate deploy` tự tạo nếu chưa có.
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgresql://bkquiz:bkquiz@localhost:5433/bkquiz_e2e?schema=public';

// Set webServer.url and use.baseURL with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<ChromaticConfig>({
  testDir: './tests',
  // Look for files with the .spec.js or .e2e.js extension
  testMatch: '*.@(spec|e2e).?(c|m)[jt]s?(x)',
  // Timeout per test, test running locally are slower due to database connections with PGLite
  timeout: 60 * 1000,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Reporter to use. See https://playwright.dev/docs/test-reporters
  reporter: process.env.CI ? 'github' : 'list',

  expect: {
    // Set timeout for async expect matchers
    timeout: 20 * 1000,
  },

  // Server cho e2e: migrate database e2e → build → next start (không dùng `next dev`: Next 16 chỉ cho
  // 1 dev server mỗi thư mục, sẽ đụng dev server của người dùng). Đang có server ở E2E_PORT thì dùng lại.
  webServer: {
    command: `npx prisma migrate deploy && npm run build:next && npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    timeout: 6 * 60 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      // Đăng nhập theo vai trò qua /api/dev/role (không cần Google)
      DEV_BYPASS_AUTH: '1',
      // Rút ngắn khoảng giữa 2 checkpoint (chỉ có tác dụng khi DEV_BYPASS_AUTH=1)
      BKQUIZ_CHECKPOINT_SECONDS: '10',
      // Test chạy nhanh hơn người thật → không để rate limit làm test chập chờn
      RATE_LIMIT_DISABLED: '1',
      NEXT_PUBLIC_SENTRY_DISABLED: 'true',
    },
  },

  // Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions.
  use: {
    // Use baseURL so to make navigations relative.
    // More information: https://playwright.dev/docs/api/class-testoptions#test-options-base-url
    baseURL,

    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: process.env.CI ? 'on' : 'retain-on-failure',

    // Record videos when retrying the failed test.
    video: process.env.CI ? 'retain-on-failure' : undefined,

    // Disable automatic screenshots at test completion when using Chromatic test fixture.
    disableAutoSnapshot: true,
  },

  projects: [
    {
      name: 'chromium',
      // PW_CHANNEL=chrome: dùng Chrome đã cài trên máy thay cho Chromium của Playwright (khỏi `npx playwright install`)
      use: { ...devices['Desktop Chrome'], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) },
    },
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
        ]
      : []),
  ],
});
