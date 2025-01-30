import puppeteer from 'puppeteer';
import { scrollPageToBottom } from 'puppeteer-autoscroll-down';
import { sites, defaultViewports } from '../config.js';

const takeScreenshot = async (page, site, name, viewport) => {
  try {
    await page.setViewport({
      width: viewport.width,
      height: 800,
      deviceScaleFactor: 1,
      isMobile: viewport.isMobile,
    });

    await page.goto(site, {
      waitUntil: 'networkidle2',
      timeout: 0,
    });

    // To get lazy loading images we start at the top...
    await page.evaluate(() => window.scrollTo(0, 0));

    // ...and then scroll to the bottom...
    await scrollPageToBottom(page);

    // Add delay to ensure lazy-loaded content is loaded
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    // ...and then scroll back to the top so fixed headers are at the top of the page.
    await page.evaluate(() => window.scrollTo(0, 0));

    const suffix = `${viewport.width}${viewport.isMobile ? '-mobile' : ''}`;
    await page.screenshot({
      path: `screenshots/screenshot-${name}--${suffix}-screen.png`,
      fullPage: true,
    });
  } catch (error) {
    console.error(
      `Error taking ${viewport.width}px screenshot for ${site}:`,
      error,
    );
  }
};

const screenshots = async (site, browser, config = {}) => {
  try {
    const name = site
      .replace(/^https?:\/\//i, '')
      .replace('www.', '')
      .replace('.', '-')
      .replace(/\/+/g, '-');

    const page = await browser.newPage();

    console.log(`Taking screenshots for ${site}...`);

    // Use provided viewports or fall back to default configurations
    const viewports = config.viewports || defaultViewports;

    // Take screenshots for each viewport configuration
    for (const viewport of viewports) {
      await takeScreenshot(page, site, name, viewport);
    }

    await page.close();
    console.log(`Completed screenshots for ${site}`);
  } catch (error) {
    console.error(`Error processing ${site}:`, error);
  }
};

async function main() {
  const browser = await puppeteer.launch();
  try {
    for (const site of sites) {
      await screenshots(site, browser);
    }
    console.log('All screenshots are finished.');
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await browser.close();
  }
}

main();
