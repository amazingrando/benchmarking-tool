export const sites = ['https://example.com'];

export const defaultViewports = [
  { width: 1200, isMobile: false },
  { width: 360, isMobile: true },
];

// Optional. Defaults to Chromium, Firefox, and WebKit.
export const browsers = ['chromium', 'firefox', 'webkit'];

// Optional. How many times to run Lighthouse for each URL. Defaults to 6.
export const lighthouseRuns = 6;
