import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const METRICS = [
  ['fcp', 'first-contentful-paint'],
  ['lcp', 'largest-contentful-paint'],
  ['tbt', 'total-blocking-time'],
  ['cls', 'cumulative-layout-shift'],
  ['speedIndex', 'speed-index'],
  ['tti', 'interactive'],
];

export const summarizeLighthouse = (lhr, url) => {
  const score = (id) => {
    const value = lhr.categories?.[id]?.score;
    if (typeof value !== 'number') return null;
    return Math.round(value * 100);
  };

  return {
    url,
    scores: {
      performance: score('performance'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
      seo: score('seo'),
    },
    metrics: Object.fromEntries(
      METRICS.map(([name, auditId]) => {
        const audit = lhr.audits?.[auditId];
        return [
          name,
          {
            display: audit?.displayValue ?? null,
            score: typeof audit?.score === 'number' ? audit.score : null,
          },
        ];
      }),
    ),
    error: null,
  };
};

export const runLighthouseAudit = async (url) => {
  let chrome;
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const result = await lighthouse(url, {
      logLevel: 'error',
      output: 'json',
      onlyCategories: CATEGORIES,
      port: chrome.port,
    });

    if (!result?.lhr) {
      return {
        url,
        scores: null,
        metrics: null,
        error: 'Lighthouse returned no result.',
      };
    }

    return summarizeLighthouse(result.lhr, url);
  } catch (error) {
    return {
      url,
      scores: null,
      metrics: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (chrome) await chrome.kill();
  }
};
