import fs from 'fs';
import path from 'path';
import { runAxe } from './axe.js';
import { slugFromUrl } from './filename.js';
import {
  collectKeyboard,
  collectReducedMotion,
  collectReflow,
  collectStructure,
} from './heuristics.js';
import { runHtmlcs } from './htmlcs.js';
import { scrollPage } from './scroll.js';
import { NAV_TIMEOUT_MS } from './settings.js';

const messageFrom = (error) =>
  error instanceof Error ? error.message : String(error);

const emptyResult = (browserName) => ({
  browser: browserName,
  error: null,
  engineErrors: [],
  issues: [],
  structure: { headings: [], landmarks: [] },
  keyboard: { sequence: [], notes: [] },
  reflow: null,
  reducedMotion: null,
  screenshots: [],
});

const shotPath = (browserName, filename) =>
  path.posix.join('screenshots', browserName, filename);

const saveScreenshot = async (page, runDir, relativePath) => {
  const absolute = path.join(runDir, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  await page.screenshot({ path: absolute, fullPage: true });
};

const gotoPage = (page, url) =>
  page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });

const runEngines = async (page, result) => {
  try {
    const axeIssues = await runAxe(page);
    result.issues.push(...axeIssues);
  } catch (error) {
    result.engineErrors.push(`axe: ${messageFrom(error)}`);
  }

  try {
    const htmlcsIssues = await runHtmlcs(page);
    result.issues.push(...htmlcsIssues);
  } catch (error) {
    result.engineErrors.push(`htmlcs: ${messageFrom(error)}`);
  }
};

const desktopPass = async ({
  browser,
  browserName,
  url,
  slug,
  runDir,
  viewports,
  screenshotsOnly,
  result,
}) => {
  const desktop = viewports.filter((viewport) => !viewport.isMobile);
  const desktopWidth = desktop[0]?.width ?? 1200;
  const context = await browser.newContext({
    viewport: { width: desktopWidth, height: 800 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  try {
    await gotoPage(page, url);
    await scrollPage(page);

    for (const viewport of desktop) {
      await page.setViewportSize({ width: viewport.width, height: 800 });
      const relative = shotPath(browserName, `${slug}--${viewport.width}.png`);
      // Each width is a separate capture of the same page.
      // eslint-disable-next-line no-await-in-loop
      await saveScreenshot(page, runDir, relative);
      result.screenshots.push({
        width: viewport.width,
        isMobile: false,
        path: relative,
      });
    }

    if (screenshotsOnly) return;

    await page.setViewportSize({ width: desktopWidth, height: 800 });
    await runEngines(page, result);

    try {
      result.structure = await collectStructure(page);
    } catch (error) {
      result.engineErrors.push(`structure: ${messageFrom(error)}`);
    }

    try {
      result.keyboard = await collectKeyboard(page);
    } catch (error) {
      result.engineErrors.push(`keyboard: ${messageFrom(error)}`);
    }

    await page.setViewportSize({ width: 320, height: 640 });
    try {
      result.reflow = await collectReflow(page);
      if (result.reflow?.overflow) {
        const relative = shotPath(browserName, `${slug}--320-reflow.png`);
        await saveScreenshot(page, runDir, relative);
        result.reflow.screenshot = relative;
      }
    } catch (error) {
      result.engineErrors.push(`reflow: ${messageFrom(error)}`);
    }

    await page.setViewportSize({ width: desktopWidth, height: 800 });
    try {
      result.reducedMotion = await collectReducedMotion(page, url);
    } catch (error) {
      result.engineErrors.push(`reduced motion: ${messageFrom(error)}`);
    }
  } finally {
    await context.close();
  }
};

const mobilePass = async ({
  browser,
  browserName,
  url,
  slug,
  runDir,
  viewport,
  result,
}) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  try {
    await gotoPage(page, url);
    await scrollPage(page);
    const relative = shotPath(
      browserName,
      `${slug}--${viewport.width}-mobile.png`,
    );
    await saveScreenshot(page, runDir, relative);
    result.screenshots.push({
      width: viewport.width,
      isMobile: true,
      path: relative,
    });
  } finally {
    await context.close();
  }
};

export const auditUrl = async ({
  browser,
  browserName,
  url,
  runDir,
  viewports,
  screenshotsOnly,
}) => {
  const result = emptyResult(browserName);
  const slug = slugFromUrl(url);

  try {
    await desktopPass({
      browser,
      browserName,
      url,
      slug,
      runDir,
      viewports,
      screenshotsOnly,
      result,
    });
  } catch (error) {
    result.error = messageFrom(error);
  }

  for (const viewport of viewports.filter((item) => item.isMobile)) {
    try {
      // Mobile screenshots use a separate emulated device context.
      // eslint-disable-next-line no-await-in-loop
      await mobilePass({
        browser,
        browserName,
        url,
        slug,
        runDir,
        viewport,
        result,
      });
    } catch (error) {
      const mobileError = `${viewport.width}px screenshot: ${messageFrom(error)}`;
      result.error = result.error
        ? `${result.error} ${mobileError}`
        : mobileError;
    }
  }

  return result;
};
