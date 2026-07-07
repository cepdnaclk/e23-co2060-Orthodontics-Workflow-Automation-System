#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium, webkit, devices } = require('playwright');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const TEST_EMAIL = process.env.TOUCH_TEST_EMAIL || process.env.ADMIN_EMAIL;
const TEST_PASSWORD = process.env.TOUCH_TEST_PASSWORD || process.env.ADMIN_PASSWORD;
const INCLUDE_WEBKIT = /^(1|true|yes)$/i.test(process.env.TOUCH_TEST_WEBKIT || '');
const ARTIFACT_DIR = process.env.TOUCH_TEST_ARTIFACT_DIR || path.join(os.tmpdir(), 'orthoflow-touch-regression');

const chromeProfiles = [
  {
    name: 'Desktop Chrome',
    browserName: 'chromium',
    contextOptions: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    }
  },
  {
    name: 'Android Chrome Phone',
    browserName: 'chromium',
    contextOptions: {
      ...devices['Pixel 5'],
      viewport: { width: 393, height: 851 }
    }
  },
  {
    name: 'Android Chrome Tablet',
    browserName: 'chromium',
    contextOptions: {
      viewport: { width: 820, height: 1180 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }
  }
];

const webkitProfiles = [
  {
    name: 'iPhone Safari-like WebKit',
    browserName: 'webkit',
    contextOptions: devices['iPhone 13']
  },
  {
    name: 'iPad Safari-like WebKit',
    browserName: 'webkit',
    contextOptions: devices['iPad Pro 11']
  }
];

const profiles = INCLUDE_WEBKIT ? [...chromeProfiles, ...webkitProfiles] : chromeProfiles;

const urlFor = (route) => `${FRONTEND_URL}${route.startsWith('/') ? route : `/${route}`}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const ensureConfig = () => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      [
        'Missing test credentials.',
        'Set TOUCH_TEST_EMAIL and TOUCH_TEST_PASSWORD for a safe test user.',
        'You can also use ADMIN_EMAIL and ADMIN_PASSWORD for a trusted local/staging smoke test.'
      ].join(' ')
    );
  }
};

const getBrowserType = (browserName) => {
  if (browserName === 'chromium') return chromium;
  if (browserName === 'webkit') return webkit;
  throw new Error(`Unsupported browser: ${browserName}`);
};

const saveFailureScreenshot = async (page, profileName, label) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const filePath = path.join(ARTIFACT_DIR, `${sanitizeName(profileName)}-${sanitizeName(label)}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
  return filePath;
};

const login = async (page) => {
  await page.goto(urlFor('/login'), { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in to portal/i }).click();

  const logoutButton = page.getByRole('button', { name: /logout/i });
  const loginResult = await Promise.race([
    logoutButton.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'authenticated'),
    page.waitForURL((url) => !/\/login\b/.test(url.pathname), { timeout: 30000 }).then(() => 'navigated'),
    page.getByText(/invalid email or password|login failed|please fill in all fields|account is inactive/i)
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => 'error')
  ]).catch(() => 'timeout');

  await page.waitForLoadState('networkidle').catch(() => {});

  const hasAccessToken = await page.evaluate(() => Boolean(localStorage.getItem('accessToken'))).catch(() => false);
  if (loginResult === 'error' || !hasAccessToken) {
    const visibleError = await page
      .getByText(/invalid email or password|login failed|please fill in all fields|account is inactive/i)
      .first()
      .textContent()
      .catch(() => '');
    throw new Error(`Login did not complete${visibleError ? `: ${visibleError.trim()}` : ''}`);
  }

  if (/\/settings\b/.test(page.url())) {
    throw new Error('The test user must change password before touch regression can run.');
  }
};

const assertMainScrolls = async (page, label) => {
  const main = page.locator('main').first();
  await main.waitFor({ state: 'visible', timeout: 10000 });

  const result = await main.evaluate(async (node) => {
    const mainEl = node;
    const previousTop = mainEl.scrollTop;
    const spacer = document.createElement('div');
    spacer.setAttribute('data-touch-regression-spacer', 'true');
    spacer.style.cssText = 'height: 1800px; width: 1px; pointer-events: none;';
    mainEl.appendChild(spacer);
    mainEl.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = mainEl.scrollTop;
    mainEl.scrollBy({ top: 620, behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = mainEl.scrollTop;
    const bodyScrollTop = document.scrollingElement?.scrollTop || 0;
    spacer.remove();
    mainEl.scrollTop = previousTop;
    return {
      before,
      after,
      bodyScrollTop,
      clientHeight: mainEl.clientHeight,
      scrollHeight: mainEl.scrollHeight,
      overflowY: window.getComputedStyle(mainEl).overflowY
    };
  });

  if (result.after <= result.before + 80) {
    throw new Error(`${label}: main content did not scroll enough (${JSON.stringify(result)})`);
  }

  if (!['auto', 'scroll'].includes(result.overflowY)) {
    throw new Error(`${label}: main overflow-y is ${result.overflowY}, expected auto/scroll`);
  }
};

const assertNoPageHorizontalOverflow = async (page, label) => {
  const result = await page.evaluate(() => {
    const body = document.body;
    const doc = document.documentElement;
    return {
      innerWidth: window.innerWidth,
      bodyScrollWidth: body.scrollWidth,
      docScrollWidth: doc.scrollWidth
    };
  });

  const overflow = Math.max(result.bodyScrollWidth, result.docScrollWidth) - result.innerWidth;
  if (overflow > 12) {
    throw new Error(`${label}: page has horizontal overflow of ${overflow}px (${JSON.stringify(result)})`);
  }
};

const assertNoPermissionBanner = async (page, label) => {
  const banner = page.getByText(/insufficient permissions/i).first();
  if (await banner.isVisible().catch(() => false)) {
    throw new Error(`${label}: visible insufficient permissions banner`);
  }
};

const visitAndCheck = async (page, route, label) => {
  await page.goto(urlFor(route), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await assertMainScrolls(page, label);
  await assertNoPageHorizontalOverflow(page, label);
  await assertNoPermissionBanner(page, label);
};

const openAndCancelAssignModalIfAvailable = async (page, label) => {
  await page.goto(urlFor('/patients'), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const assignButton = page.getByRole('button', { name: /assign (team|students)/i }).first();
  if (!(await assignButton.isVisible().catch(() => false))) {
    return 'skipped: no assign button visible for this role/data set';
  }

  await assignButton.click();
  const dialogTitle = page.getByText(/assign (care team|students)/i).first();
  await dialogTitle.waitFor({ state: 'visible', timeout: 10000 });
  await assertNoPageHorizontalOverflow(page, `${label} assign modal`);
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await dialogTitle.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  return 'passed';
};

const openDentalPopoverIfAvailable = async (page, label) => {
  await page.goto(urlFor('/patients'), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const firstPatientRow = page.locator('tbody tr').first();
  if (!(await firstPatientRow.isVisible().catch(() => false))) {
    return 'skipped: no patient rows visible for this role/data set';
  }

  await firstPatientRow.click();
  await page.waitForLoadState('networkidle').catch(() => {});

  const chartTab = page.getByRole('button', { name: /dental chart/i }).first();
  if (!(await chartTab.isVisible().catch(() => false))) {
    return 'skipped: dental chart tab not visible for this role';
  }

  await chartTab.click();
  await page.getByText(/clinical dental chart/i).waitFor({ state: 'visible', timeout: 10000 });
  await assertMainScrolls(page, `${label} dental chart`);

  const customTooth = page.locator('[data-testid^="dental-custom-tooth-"]').first();
  if (!(await customTooth.isVisible().catch(() => false))) {
    return 'skipped: no custom dental tooth button visible';
  }

  await customTooth.click();
  const popover = page.locator('[data-testid="dental-tooth-popover"]');
  await popover.waitFor({ state: 'visible', timeout: 10000 });

  const pathologyInput = page.locator('[data-testid="dental-pathology-input"]').first();
  const treatmentInput = page.locator('[data-testid="dental-treatment-input"]').first();
  if (await pathologyInput.isVisible().catch(() => false)) {
    await pathologyInput.focus();
    await sleep(150);
    if (!(await popover.isVisible().catch(() => false))) {
      throw new Error(`${label}: dental popover closed after focusing pathology input`);
    }
  }
  if (await treatmentInput.isVisible().catch(() => false)) {
    await treatmentInput.focus();
    await sleep(150);
    if (!(await popover.isVisible().catch(() => false))) {
      throw new Error(`${label}: dental popover closed after focusing treatment input`);
    }
  }

  await page.keyboard.press('Escape').catch(() => {});
  return 'passed';
};

const runProfile = async (profile) => {
  const browserType = getBrowserType(profile.browserName);
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext(profile.contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const steps = [];
  const runStep = async (name, fn) => {
    try {
      const result = await fn();
      steps.push({ name, status: result || 'passed' });
    } catch (error) {
      const screenshot = await saveFailureScreenshot(page, profile.name, name);
      throw new Error(`${profile.name} / ${name}: ${error.message}. Screenshot: ${screenshot}`);
    }
  };

  try {
    await runStep('login', () => login(page));
    await runStep('dashboard scroll', () => visitAndCheck(page, '/', 'Dashboard'));
    await runStep('patients scroll', () => visitAndCheck(page, '/patients', 'Patients'));
    await runStep('queue scroll', () => visitAndCheck(page, '/queue', 'Queue'));
    await runStep('cases scroll', () => visitAndCheck(page, '/cases', 'Student Cases'));
    await runStep('settings scroll', () => visitAndCheck(page, '/settings', 'Settings'));
    await runStep('assign modal read-only open/cancel', () => openAndCancelAssignModalIfAvailable(page, profile.name));
    await runStep('dental popover focus stability', () => openDentalPopoverIfAvailable(page, profile.name));

    if (pageErrors.length) {
      throw new Error(`Page errors were emitted: ${pageErrors.join(' | ')}`);
    }

    return {
      profile: profile.name,
      steps,
      consoleErrors: consoleErrors.slice(0, 5)
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
};

const main = async () => {
  ensureConfig();
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  console.log(`Touch regression target: ${FRONTEND_URL}`);
  console.log(`Artifact directory: ${ARTIFACT_DIR}`);
  console.log(`Profiles: ${profiles.map((profile) => profile.name).join(', ')}`);
  console.log('Mutation mode: disabled (read-only checks only)');

  const results = [];
  for (const profile of profiles) {
    console.log(`\n▶ ${profile.name}`);
    const result = await runProfile(profile);
    results.push(result);
    for (const step of result.steps) {
      console.log(`  ✓ ${step.name}${step.status === 'passed' ? '' : ` (${step.status})`}`);
    }
    if (result.consoleErrors.length) {
      console.log(`  ⚠ console errors observed: ${result.consoleErrors.join(' | ')}`);
    }
  }

  console.log('\nTouch regression passed.');
  console.log('No test records were created, so no system cleanup is required.');
};

main().catch((error) => {
  console.error(`\nTouch regression failed: ${error.message}`);
  process.exit(1);
});
