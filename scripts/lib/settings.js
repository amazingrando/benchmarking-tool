import fs from 'fs';

const configPath = new URL('../../config.js', import.meta.url);

if (!fs.existsSync(configPath)) {
  console.error(
    'Missing config.js. Copy config.example.js to config.js and edit the site list.',
  );
  process.exit(1);
}

const config = await import(configPath.href);

export const DEFAULT_BROWSERS = ['chromium', 'firefox', 'webkit'];

export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

export const NAV_TIMEOUT_MS = 60000;
export const TAB_LIMIT = 50;
export const NOTE_CAP = 25;

export const loadSettings = () => {
  const browsers =
    Array.isArray(config.browsers) && config.browsers.length
      ? config.browsers
      : DEFAULT_BROWSERS;

  return {
    sites: config.sites ?? [],
    viewports: config.defaultViewports ?? [
      { width: 1200, isMobile: false },
      { width: 360, isMobile: true },
    ],
    browsers,
  };
};
