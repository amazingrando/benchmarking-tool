import puppeteer from 'puppeteer';
import { scrollPageToBottom } from 'puppeteer-autoscroll-down';
import sites from '../urls.js';

const screenshotLargeScreen = async (site, name) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false,
  });

  await page.goto(site, {
    waitUntil: 'networkidle2',
    timeout: 0,
  });

  // To get lazy loading images we start at the top...
  await page.evaluate((_) => {
    window.scrollTo(0, 0);
  });

  // ...and then scroll to the bottom...
  await scrollPageToBottom(page);

  // ...and then scroll back to the top so fixed headers are at the top of the page.
  await page.evaluate((_) => {
    window.scrollTo(0, 0);
  });

  await page.screenshot({
    path: `screenshots/screenshot-${name}--large-screen.png`,
    fullPage: true,
  });

  await browser.close();
};

const screenshotSmallScreen = async (site, name) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({
    width: 360,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: true,
  });

  await page.goto(site, {
    waitUntil: 'networkidle2',
    timeout: 0,
  });

  // To get lazy loading images we start at the top...
  await page.evaluate((_) => {
    window.scrollTo(0, 0);
  });

  // ...and then scroll to the bottom...
  await scrollPageToBottom(page);

  // ...and then scroll back to the top so fixed headers are at the top of the page.
  await page.evaluate((_) => {
    window.scrollTo(0, 0);
  });

  await page.screenshot({
    path: `screenshots/screenshot-${name}--small-screen.png`,
    fullPage: true,
  });

  await browser.close();
};

const screenshots = async (site) => {
  const name = site
    .replace(/^https?:\/\//i, '')
    .replace('www.', '')
    .replace('.', '-')
    .replace(/\/+/g, '-');

  screenshotLargeScreen(site, name);
  screenshotSmallScreen(site, name);
};

sites
  .reduce(
    (chain, item) => chain.then(() => screenshots(item)),
    Promise.resolve(),
  )
  .then(() => console.log('All screenshots are finished.'));
