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

const failedAudits = (lhr, categoryId) =>
  (lhr.categories?.[categoryId]?.auditRefs ?? [])
    .map((ref) => lhr.audits?.[ref.id])
    .filter(
      (audit) => audit && typeof audit.score === 'number' && audit.score < 1,
    )
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      description: audit.description ?? '',
      displayValue: audit.displayValue ?? null,
      score: Math.round(audit.score * 100),
    }))
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));

const metricValue = (audit) =>
  typeof audit?.numericValue === 'number' ? audit.numericValue : null;

const formatSeconds = (milliseconds) => `${(milliseconds / 1000).toFixed(1)} s`;

const formatCls = (value) => {
  if (value === 0) return '0';
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

export const formatMetricValue = (name, value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (name === 'cls') return formatCls(value);
  if (name === 'tbt') return `${Math.round(value)} ms`;
  return formatSeconds(value);
};

export const median = (values) => {
  const sorted = values
    .filter((value) => typeof value === 'number' && !Number.isNaN(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const numberRange = (values) => {
  const numbers = values.filter(
    (value) => typeof value === 'number' && !Number.isNaN(value),
  );
  if (!numbers.length) return { min: null, median: null, max: null };
  return {
    min: Math.min(...numbers),
    median: median(numbers),
    max: Math.max(...numbers),
  };
};

const messageFrom = (error) =>
  error instanceof Error ? error.message : String(error);

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
        const value = metricValue(audit);
        return [
          name,
          {
            display: audit?.displayValue ?? formatMetricValue(name, value),
            score: typeof audit?.score === 'number' ? audit.score : null,
            value,
          },
        ];
      }),
    ),
    findings: Object.fromEntries(
      CATEGORIES.map((categoryId) => [
        categoryId,
        failedAudits(lhr, categoryId),
      ]),
    ),
    error: null,
  };
};

const medianRun = (runs) => {
  const performance = median(runs.map((run) => run.scores?.performance));
  if (performance === null) return runs[Math.floor(runs.length / 2)];

  return runs.reduce((closest, run) => {
    const distance = Math.abs(
      (run.scores?.performance ?? Infinity) - performance,
    );
    const closestDistance = Math.abs(
      (closest.scores?.performance ?? Infinity) - performance,
    );
    return distance < closestDistance ? run : closest;
  });
};

export const aggregateLighthouseRuns = (
  runs,
  { url, requestedRuns, errors },
) => {
  const chosen = medianRun(runs);
  const scoreRange = (key) => numberRange(runs.map((run) => run.scores?.[key]));
  const metricRange = (name) => {
    const range = numberRange(runs.map((run) => run.metrics?.[name]?.value));
    return {
      min: {
        value: range.min,
        display: formatMetricValue(name, range.min),
      },
      median: {
        value: range.median,
        display: formatMetricValue(name, range.median),
      },
      max: {
        value: range.max,
        display: formatMetricValue(name, range.max),
      },
    };
  };

  return {
    url,
    requestedRuns,
    completedRuns: runs.length,
    runErrors: errors,
    scores: {
      performance: scoreRange('performance'),
      accessibility: scoreRange('accessibility'),
      bestPractices: scoreRange('bestPractices'),
      seo: scoreRange('seo'),
    },
    metrics: Object.fromEntries(
      METRICS.map(([name]) => [name, metricRange(name)]),
    ),
    findings: chosen.findings,
    error: null,
  };
};

const emptyResult = (url, requestedRuns, error) => ({
  url,
  requestedRuns,
  completedRuns: 0,
  runErrors: error ? [error] : [],
  scores: null,
  metrics: null,
  findings: null,
  error,
});

export const runLighthouseAudits = async (url, runCount) => {
  const count = Number.isInteger(runCount) && runCount >= 1 ? runCount : 6;
  let chrome;
  const runs = [];
  const errors = [];

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (let index = 0; index < count; index += 1) {
      console.log(`Lighthouse run ${index + 1} of ${count}: ${url}`);
      try {
        // Each pass needs the previous one to finish before Chrome is reused.
        // eslint-disable-next-line no-await-in-loop
        const result = await lighthouse(url, {
          logLevel: 'error',
          output: 'json',
          onlyCategories: CATEGORIES,
          port: chrome.port,
        });

        if (!result?.lhr) {
          errors.push(`Run ${index + 1} returned no result.`);
        } else {
          runs.push(summarizeLighthouse(result.lhr, url));
        }
      } catch (error) {
        errors.push(`Run ${index + 1}: ${messageFrom(error)}`);
      }
    }
  } catch (error) {
    return emptyResult(url, count, messageFrom(error));
  } finally {
    if (chrome) await chrome.kill();
  }

  if (!runs.length) {
    return emptyResult(
      url,
      count,
      errors.join(' ') || 'Lighthouse returned no result.',
    );
  }

  return aggregateLighthouseRuns(runs, { url, requestedRuns: count, errors });
};
