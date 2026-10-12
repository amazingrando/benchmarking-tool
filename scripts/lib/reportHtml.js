const IMPACT_ORDER = [
  'critical',
  'serious',
  'error',
  'moderate',
  'warning',
  'minor',
  'notice',
  'unknown',
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const safeUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    return '';
  }
  return '';
};

const SEVERITY = {
  critical: 'severe',
  serious: 'severe',
  error: 'severe',
  moderate: 'moderate',
  warning: 'moderate',
  minor: 'low',
  notice: 'low',
  unknown: 'low',
};

const SEVERITY_LABEL = {
  severe: 'Severe',
  moderate: 'Moderate',
  low: 'Low',
};

const impactRank = (impact) => {
  const index = IMPACT_ORDER.indexOf(impact);
  return index === -1 ? IMPACT_ORDER.length : index;
};

const severityOf = (impact) => SEVERITY[impact] ?? 'low';

const countSeverity = (issues, severity) =>
  issues.filter((issue) => severityOf(issue.impact) === severity).length;

const groupIssues = (page) => {
  const grouped = new Map();

  for (const browserResult of page.browsers) {
    for (const issue of browserResult.issues ?? []) {
      const key = [issue.source, issue.id, issue.selector, issue.message].join(
        '\u0000',
      );
      if (!grouped.has(key)) {
        grouped.set(key, { ...issue, browsers: [] });
      }
      const entry = grouped.get(key);
      if (!entry.browsers.includes(browserResult.browser)) {
        entry.browsers.push(browserResult.browser);
      }
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const byImpact = impactRank(a.impact) - impactRank(b.impact);
    if (byImpact !== 0) return byImpact;
    return a.id.localeCompare(b.id);
  });
};

const lighthouseFor = (lighthouse, url) =>
  lighthouse.results?.find((result) => result.url === url) ?? null;

const RATING_LABEL = {
  good: 'Good',
  'needs-improvement': 'Needs improvement',
  poor: 'Poor',
};

const METRIC_BOUNDS = {
  fcp: { good: 1800, poor: 3000 },
  lcp: { good: 2500, poor: 4000 },
  tbt: { good: 200, poor: 600 },
  cls: { good: 0.1, poor: 0.25 },
  speedIndex: { good: 3400, poor: 5800 },
  tti: { good: 3800, poor: 7300 },
};

const categoryRating = (score) => {
  if (typeof score !== 'number') return null;
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
};

const ratingFromAuditScore = (score) => {
  if (typeof score !== 'number') return null;
  if (score >= 0.9) return 'good';
  if (score >= 0.5) return 'needs-improvement';
  return 'poor';
};

const parseMetricValue = (display) => {
  const text = String(display)
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .trim();
  const match = text.match(/^(-?[\d.]+)\s*(ms|s)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return null;
  if (match[2]?.toLowerCase() === 's') return amount * 1000;
  return amount;
};

const ratingFromDisplay = (display, metricName) => {
  const bounds = METRIC_BOUNDS[metricName];
  const value = parseMetricValue(display);
  if (!bounds || value === null) return null;
  if (value <= bounds.good) return 'good';
  if (value <= bounds.poor) return 'needs-improvement';
  return 'poor';
};

const metricDisplay = (metric) => {
  if (metric && typeof metric === 'object') return metric.display;
  return metric;
};

const ratingFromNumber = (value, metricName) => {
  const bounds = METRIC_BOUNDS[metricName];
  if (!bounds || typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value <= bounds.good) return 'good';
  if (value <= bounds.poor) return 'needs-improvement';
  return 'poor';
};

const metricRating = (metric, metricName) => {
  if (metric && typeof metric === 'object') {
    return (
      ratingFromNumber(metric.value, metricName) ??
      ratingFromAuditScore(metric.score) ??
      ratingFromDisplay(metric.display, metricName)
    );
  }
  return ratingFromDisplay(metric, metricName);
};

const renderRatedCell = (text, rating) => {
  if (text === null || text === undefined || text === '') return '<td>—</td>';
  const shown = escapeHtml(text);
  if (!rating) return `<td>${shown}</td>`;
  return `<td class="rating-${rating}">${shown}, ${RATING_LABEL[rating]}</td>`;
};

const LIGHTHOUSE_CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best practices'],
  ['seo', 'SEO'],
];

const renderLighthouseText = (markdown) => {
  const source = String(markdown ?? '');
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`/g;
  const parts = [];
  let last = 0;

  for (const match of source.matchAll(pattern)) {
    parts.push(escapeHtml(source.slice(last, match.index)));
    if (match[3] != null) {
      parts.push(`<code>${escapeHtml(match[3])}</code>`);
    } else {
      const href = safeUrl(match[2]);
      parts.push(
        href
          ? `<a href="${escapeHtml(href)}">${escapeHtml(match[1])}</a>`
          : escapeHtml(match[0]),
      );
    }
    last = match.index + match[0].length;
  }

  parts.push(escapeHtml(source.slice(last)));
  return parts.join('');
};

const renderFinding = (finding) => {
  const rating = categoryRating(finding.score);
  const ratingClass = rating ? ` class="finding-score rating-${rating}"` : '';
  const ratingText = rating ? `, ${RATING_LABEL[rating]}` : '';
  const savings = finding.displayValue
    ? ` <span class="finding-savings">${escapeHtml(finding.displayValue)}</span>`
    : '';

  return `<li>
    <p><strong>${renderLighthouseText(finding.title)}</strong>${savings}</p>
    <p${ratingClass}>Score ${escapeHtml(finding.score)}${ratingText}</p>
    <p>${renderLighthouseText(finding.description)}</p>
  </li>`;
};

const renderLighthouseFindings = (lab) => {
  if (!lab || lab.error) return '';
  if (!lab.findings) {
    return `<details>
      <summary>Lighthouse findings</summary>
      <p>This run did not save Lighthouse recommendations. Run the audit again to collect them.</p>
    </details>`;
  }

  const groups = LIGHTHOUSE_CATEGORIES.map(([id, label]) => ({
    label,
    items: lab.findings[id] ?? [],
  }));
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const sections = groups
    .map(
      (group) => `<section>
        <h4>${escapeHtml(group.label)}</h4>
        ${
          group.items.length
            ? `<ol class="findings">${group.items.map((item) => renderFinding(item)).join('')}</ol>`
            : '<p>Nothing failed in this category.</p>'
        }
      </section>`,
    )
    .join('');

  return `<details>
    <summary>${total} Lighthouse finding${total === 1 ? '' : 's'} to act on</summary>
    <p>These are the desktop Chrome audits that scored below 100, worst first, from the run closest to the median performance score. The title is the change to make, and the text under it explains why.</p>
    ${sections}
  </details>`;
};

const SCORE_KEYS = ['performance', 'accessibility', 'bestPractices', 'seo'];
const METRIC_KEYS = ['fcp', 'lcp', 'tbt', 'cls', 'speedIndex', 'tti'];
const STATS = [
  ['min', 'Minimum'],
  ['median', 'Median'],
  ['max', 'Maximum'],
];

const isSpread = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  'min' in value &&
  'median' in value &&
  'max' in value;

const spreadOf = (value) =>
  isSpread(value) ? value : { min: value, median: value, max: value };

const formatScore = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const renderStatCells = (result, stat) => {
  const scoreCells = SCORE_KEYS.map((key) => {
    const value = spreadOf(result.scores?.[key])[stat];
    return renderRatedCell(formatScore(value), categoryRating(value));
  });
  const metricCells = METRIC_KEYS.map((name) => {
    const metric = spreadOf(result.metrics?.[name])[stat];
    return renderRatedCell(metricDisplay(metric), metricRating(metric, name));
  });
  return [...scoreCells, ...metricCells].join('');
};

const renderResultRows = (page, result) => {
  if (!result) {
    return `<tr><th scope="row">${escapeHtml(page.url)}</th><td colspan="11">No Lighthouse result for this URL.</td></tr>`;
  }
  if (result.error || !result.scores) {
    return `<tr><th scope="row">${escapeHtml(page.url)}</th><td colspan="11">${escapeHtml(result.error || 'Lighthouse failed.')}</td></tr>`;
  }

  return STATS.map(([stat, label], index) => {
    const urlCell =
      index === 0
        ? `<th scope="row" rowspan="3">${escapeHtml(page.url)}</th>`
        : '';
    return `<tr>${urlCell}<th scope="row">${label}</th>${renderStatCells(result, stat)}</tr>`;
  }).join('');
};

const runCountSentence = (lighthouse) => {
  const requested =
    lighthouse.runs ??
    lighthouse.results?.find((result) => result.requestedRuns)?.requestedRuns;
  if (requested) {
    const noun = requested === 1 ? 'run' : 'runs';
    return `These numbers come from ${requested} desktop Chrome ${noun} per URL. Each URL has a minimum, median, and maximum row.`;
  }
  return 'These numbers come from one desktop Chrome run per URL. Minimum, median, and maximum match when only one run was saved.';
};

const renderScores = (lighthouse, pages) => {
  const rows = pages
    .map((page) => renderResultRows(page, lighthouseFor(lighthouse, page.url)))
    .join('');

  return `<section>
    <h2>Lighthouse lab results</h2>
    <p>${escapeHtml(runCountSentence(lighthouse))} Total Blocking Time is the lab stand-in for Interaction to Next Paint. This report does not include field data.</p>
    <ul class="rating-legend">
      <li><span class="swatch rating-good">Good</span> Category score 90–100. First Contentful Paint ≤ 1.8 s, Largest Contentful Paint ≤ 2.5 s, Total Blocking Time ≤ 200 ms, Cumulative Layout Shift ≤ 0.1, Speed Index ≤ 3.4 s, Time to Interactive ≤ 3.8 s.</li>
      <li><span class="swatch rating-needs-improvement">Needs improvement</span> Category score 50–89. Lab metrics between the good and poor cutoffs.</li>
      <li><span class="swatch rating-poor">Poor</span> Category score 0–49. First Contentful Paint &gt; 3 s, Largest Contentful Paint &gt; 4 s, Total Blocking Time &gt; 600 ms, Cumulative Layout Shift &gt; 0.25, Speed Index &gt; 5.8 s, Time to Interactive &gt; 7.3 s.</li>
    </ul>
    <div class="table-scroll" tabindex="0">
      <table>
        <caption>Lighthouse category scores and lab Core Web Vitals</caption>
        <thead>
          <tr>
            <th scope="col">URL</th>
            <th scope="col">Statistic</th>
            <th scope="col">Performance</th>
            <th scope="col">Accessibility</th>
            <th scope="col">Best practices</th>
            <th scope="col">SEO</th>
            <th scope="col">First Contentful Paint</th>
            <th scope="col">Largest Contentful Paint</th>
            <th scope="col">Total Blocking Time</th>
            <th scope="col">Cumulative Layout Shift</th>
            <th scope="col">Speed Index</th>
            <th scope="col">Time to Interactive</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="12">No URLs were audited.</td></tr>'}</tbody>
      </table>
    </div>
  </section>`;
};

const renderIssueTable = (issues) => {
  if (!issues.length) {
    return '<p>No engine issues recorded.</p>';
  }

  const rows = issues
    .map((issue) => {
      const help = safeUrl(issue.helpUrl);
      const helpLink = help
        ? ` <a href="${escapeHtml(help)}">Rule help</a>`
        : '';
      const tags = (issue.tags ?? []).join(', ');
      const severity = severityOf(issue.impact);
      return `<tr class="severity-${severity}">
        <td>${escapeHtml(issue.browsers.join(', '))}</td>
        <td class="severity">${escapeHtml(SEVERITY_LABEL[severity])}, ${escapeHtml(issue.impact)}</td>
        <td>${escapeHtml(issue.source)}</td>
        <td><code>${escapeHtml(issue.id)}</code></td>
        <td>${escapeHtml(issue.message)}${helpLink}</td>
        <td><code>${escapeHtml(issue.selector)}</code></td>
        <td>${escapeHtml(tags)}</td>
      </tr>`;
    })
    .join('');

  return `<ul class="severity-legend">
    <li><span class="swatch severity-severe">Severe</span> axe critical and serious, HTML_CodeSniffer errors</li>
    <li><span class="swatch severity-moderate">Moderate</span> axe moderate, HTML_CodeSniffer warnings</li>
    <li><span class="swatch severity-low">Low</span> axe minor, HTML_CodeSniffer notices</li>
  </ul>
  <div class="table-scroll" tabindex="0">
    <table>
      <caption>Issues sorted with severe first, then moderate, then low. The browser column lists every engine that reported that row.</caption>
      <thead>
        <tr>
          <th scope="col">Browsers</th>
          <th scope="col">Severity</th>
          <th scope="col">Source</th>
          <th scope="col">Rule</th>
          <th scope="col">Message</th>
          <th scope="col">Selector</th>
          <th scope="col">WCAG tags</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

const renderList = (items, renderItem, empty) => {
  if (!items.length) return `<p>${empty}</p>`;
  return `<ul>${items.map((item) => `<li>${renderItem(item)}</li>`).join('')}</ul>`;
};

const renderHeuristics = (browserResult) => {
  const structure = browserResult.structure ?? { headings: [], landmarks: [] };
  const keyboard = browserResult.keyboard ?? { sequence: [], notes: [] };
  const { reflow } = browserResult;
  const motion = browserResult.reducedMotion;
  const name =
    browserResult.browser.charAt(0).toUpperCase() +
    browserResult.browser.slice(1);

  const headingItems = renderList(
    structure.headings ?? [],
    (heading) => `H${heading.level}: ${escapeHtml(heading.text || '(empty)')}`,
    'No headings found.',
  );
  const landmarkItems = renderList(
    structure.landmarks ?? [],
    (landmark) =>
      `${escapeHtml(landmark.role)}${landmark.label ? `: ${escapeHtml(landmark.label)}` : ''}`,
    'No landmarks found.',
  );
  const sequenceItems = renderList(
    keyboard.sequence ?? [],
    (item) =>
      `<code>${escapeHtml(item.selector)}</code>${item.name ? ` ${escapeHtml(item.name)}` : ''}`,
    'No focused elements recorded.',
  );
  const noteItems = renderList(
    keyboard.notes ?? [],
    (note) =>
      `${escapeHtml(note.message)}${note.selector ? ` <code>${escapeHtml(note.selector)}</code>` : ''}`,
    'No keyboard notes.',
  );

  let reflowBlock = '<p>Reflow was not collected.</p>';
  if (reflow) {
    const shot = reflow.screenshot
      ? `<p><a href="${escapeHtml(reflow.screenshot)}">320px overflow screenshot</a></p>`
      : '';
    reflowBlock = `<p>${reflow.overflow ? 'Horizontal overflow at 320 CSS pixels.' : 'No horizontal overflow at 320 CSS pixels.'} Scroll width ${escapeHtml(reflow.scrollWidth)}, viewport ${escapeHtml(reflow.clientWidth)}.</p>
      ${shot}
      ${renderList(
        reflow.offenders ?? [],
        (offender) =>
          `<code>${escapeHtml(offender.selector)}</code> extends to ${escapeHtml(offender.right)}px (width ${escapeHtml(offender.width)}px)`,
        'No overflowing elements recorded.',
      )}`;
  }

  let motionBlock = '<p>Reduced motion was not collected.</p>';
  if (motion) {
    motionBlock = `<p>${escapeHtml(motion.total)} animation${motion.total === 1 ? '' : 's'} still running with <code>prefers-reduced-motion: reduce</code>.</p>
      ${renderList(
        motion.animations ?? [],
        (animation) =>
          `<code>${escapeHtml(animation.selector || 'unknown')}</code>`,
        'None recorded in the sample.',
      )}`;
  }

  return `<section>
    <h5>${escapeHtml(name)}</h5>
    <h6>Headings</h6>
    ${headingItems}
    <h6>Landmarks</h6>
    ${landmarkItems}
    <h6>Keyboard sequence</h6>
    ${sequenceItems}
    <h6>Keyboard notes</h6>
    ${noteItems}
    <h6>Reflow</h6>
    ${reflowBlock}
    <h6>Reduced motion</h6>
    ${motionBlock}
  </section>`;
};

const renderScreenshots = (page) => {
  const figures = page.browsers.flatMap((browserResult) =>
    (browserResult.screenshots ?? []).map((shot) => {
      const label = `${browserResult.browser}, ${shot.width}px${shot.isMobile ? ', mobile' : ''}`;
      return `<figure>
        <img src="${escapeHtml(shot.path)}" alt="Full-page screenshot of ${escapeHtml(page.url)} in ${escapeHtml(label)}" loading="lazy">
        <figcaption>${escapeHtml(label)}</figcaption>
      </figure>`;
    }),
  );

  if (!figures.length) return '<p>No screenshots captured.</p>';
  return figures.join('');
};

const renderPage = (page, lighthouse, screenshotsOnly) => {
  const issues = groupIssues(page);
  const noteCount = page.browsers.reduce(
    (total, browserResult) =>
      total + (browserResult.keyboard?.notes?.length ?? 0),
    0,
  );
  const errors = page.browsers
    .flatMap((browserResult) => [
      browserResult.error
        ? `${browserResult.browser}: ${browserResult.error}`
        : '',
      ...(browserResult.engineErrors ?? []).map(
        (engineError) => `${browserResult.browser}: ${engineError}`,
      ),
    ])
    .filter(Boolean);
  const pageHref = safeUrl(page.url);
  const pageHeading = pageHref
    ? `<a href="${escapeHtml(pageHref)}">${escapeHtml(page.url)}</a>`
    : escapeHtml(page.url);
  const lab = lighthouseFor(lighthouse, page.url);
  const labSummary =
    lab?.scores && !lab.error
      ? [
          ['Performance', lab.scores.performance],
          ['Accessibility', lab.scores.accessibility],
          ['Best practices', lab.scores.bestPractices],
          ['SEO', lab.scores.seo],
        ]
          .map(([name, score]) => {
            const spread = spreadOf(score);
            const rating = categoryRating(spread.median);
            const label = rating
              ? RATING_LABEL[rating].toLowerCase()
              : 'unrated';
            return `${name} median ${formatScore(spread.median) ?? '—'}, ${label} (minimum ${formatScore(spread.min) ?? '—'}, maximum ${formatScore(spread.max) ?? '—'})`;
          })
          .join('. ')
          .concat('.')
      : '';
  const partialRuns =
    lab?.runErrors?.length && !lab.error
      ? `${lab.completedRuns} of ${lab.requestedRuns} Lighthouse runs completed. ${lab.runErrors.join(' ')}`
      : '';

  return `<article>
    <h3>${pageHeading}</h3>
    ${labSummary ? `<p>${escapeHtml(labSummary)}</p>` : ''}
    ${partialRuns ? `<p>${escapeHtml(partialRuns)}</p>` : ''}
    ${renderLighthouseFindings(lab)}
    ${errors.length ? `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}
    <details>
      <summary>${countSeverity(issues, 'severe')} severe, ${countSeverity(issues, 'moderate')} moderate, ${countSeverity(issues, 'low')} low, ${noteCount} keyboard note${noteCount === 1 ? '' : 's'}</summary>
      <h4>Issues</h4>
      ${screenshotsOnly ? '<p>This run collected screenshots only.</p>' : renderIssueTable(issues)}
      <h4>Structure, keyboard, reflow, and reduced motion</h4>
      <p>These notes are heuristics, not WCAG verdicts. HTML_CodeSniffer uses its WCAG 2.0 AA standard and does not cover every WCAG 2.2 criterion. axe-core with the WCAG 2.2 AA tags is the 2.2 source in this report.</p>
      ${
        screenshotsOnly
          ? '<p>Heuristics were not collected for this run.</p>'
          : page.browsers
              .map((browserResult) => renderHeuristics(browserResult))
              .join('')
      }
      <h4>Screenshots</h4>
      ${renderScreenshots(page)}
    </details>
  </article>`;
};

export const renderReport = ({ lighthouse, a11y }) => {
  const pages = a11y.pages ?? [];
  const generatedAt = a11y.generatedAt || lighthouse.generatedAt || '';
  const browsers = (a11y.browsers ?? []).join(', ');
  const widths = (a11y.viewports ?? [])
    .map(
      (viewport) => `${viewport.width}px${viewport.isMobile ? ' mobile' : ''}`,
    )
    .join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility benchmark report</title>
  <style>
    :focus-visible { outline: 3px solid #0b3a82; outline-offset: 2px; }
    body { margin: 0; background: #f7f6f3; color: #1a1a1a; font-family: system-ui, sans-serif; line-height: 1.5; }
    .skip { position: absolute; left: 0.5rem; top: 0.5rem; background: #fff; padding: 0.4rem 0.6rem; transform: translateY(-150%); }
    .skip:focus-visible { transform: none; }
    main { max-width: 72rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    h1, h2, h3 { line-height: 1.25; }
    a { color: #0b3a82; }
    code { font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
    .table-scroll { overflow-x: auto; margin: 1rem 0 2rem; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    caption { text-align: left; font-weight: 600; padding: 0.4rem 0; }
    th, td { border: 1px solid #c8c4bc; text-align: left; vertical-align: top; padding: 0.4rem 0.55rem; }
    th { background: #e7e2d8; }
    article { margin: 0 0 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #c8c4bc; }
    summary { font-weight: 600; cursor: pointer; }
    .severity-legend { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; }
    .swatch { display: inline-block; padding: 0.1rem 0.45rem; border-left: 4px solid transparent; font-weight: 600; }
    .swatch.severity-severe { border-left-color: #9b1c1c; }
    .swatch.severity-moderate { border-left-color: #8a6a00; }
    .swatch.severity-low { border-left-color: #6f6a62; }
    tr.severity-severe td:first-child { box-shadow: inset 4px 0 0 #9b1c1c; }
    tr.severity-moderate td:first-child { box-shadow: inset 4px 0 0 #8a6a00; }
    tr.severity-low td:first-child { box-shadow: inset 4px 0 0 #6f6a62; }
    .severity-severe { background: #f4d6d6; color: #6b1212; }
    .severity-moderate { background: #ffe8a3; color: #5c3b00; }
    .severity-low { background: #eeeae4; color: #3f3c36; }
    .severity-severe a, .severity-moderate a, .severity-low a { color: #0b3a82; }
    td.severity { font-weight: 600; }
    .rating-legend { list-style: none; padding: 0; margin: 0 0 1rem; }
    .rating-legend li { margin: 0.35rem 0; }
    .rating-good { background: #d8f3dc; color: #0d4f1a; }
    .rating-needs-improvement { background: #ffe8a3; color: #5c3b00; }
    .rating-poor { background: #f4d6d6; color: #6b1212; }
    td.rating-good { box-shadow: inset 4px 0 0 #137333; font-weight: 600; }
    td.rating-needs-improvement { box-shadow: inset 4px 0 0 #8a6a00; font-weight: 600; }
    td.rating-poor { box-shadow: inset 4px 0 0 #9b1c1c; font-weight: 600; }
    .swatch.rating-good { border-left-color: #137333; }
    .swatch.rating-needs-improvement { border-left-color: #8a6a00; }
    .swatch.rating-poor { border-left-color: #9b1c1c; }
    ol.findings { padding-left: 1.25rem; }
    ol.findings li { margin: 0 0 1rem; }
    .finding-savings { font-weight: 600; }
    .finding-score { display: inline-block; padding: 0.1rem 0.45rem; font-weight: 600; }
    figure { margin: 1rem 0; }
    img { max-width: 100%; height: auto; border: 1px solid #c8c4bc; background: #fff; }
    figcaption { font-size: 0.9rem; }
  </style>
</head>
<body>
  <a class="skip" href="#pages">Skip to pages</a>
  <main>
    <header>
      <h1>Accessibility benchmark report</h1>
      <p>Generated <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedAt)}</time>.</p>
      <p>Browsers: ${escapeHtml(browsers || 'none')}. Screenshot widths: ${escapeHtml(widths || 'none')}.</p>
      <p>Cookie banners are left in place. Keyboard, reflow, and reduced-motion notes are heuristics, not WCAG verdicts.</p>
    </header>
    ${renderScores(lighthouse, pages)}
    <section id="pages">
      <h2>Pages</h2>
      ${pages.map((page) => renderPage(page, lighthouse, a11y.screenshotsOnly)).join('') || '<p>No pages in this run.</p>'}
    </section>
  </main>
</body>
</html>
`;
};
