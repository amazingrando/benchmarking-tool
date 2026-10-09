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

const impactRank = (impact) => {
  const index = IMPACT_ORDER.indexOf(impact);
  return index === -1 ? IMPACT_ORDER.length : index;
};

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

const renderMetricRow = (result) => {
  if (!result) {
    return '<td colspan="10">No Lighthouse result for this URL.</td>';
  }
  if (result.error || !result.scores) {
    return `<td colspan="10">${escapeHtml(result.error || 'Lighthouse failed.')}</td>`;
  }

  const cells = [
    result.scores.performance,
    result.scores.accessibility,
    result.scores.bestPractices,
    result.scores.seo,
    result.metrics?.fcp,
    result.metrics?.lcp,
    result.metrics?.tbt,
    result.metrics?.cls,
    result.metrics?.speedIndex,
    result.metrics?.tti,
  ];

  return cells.map((cell) => `<td>${escapeHtml(cell ?? '—')}</td>`).join('');
};

const renderScores = (lighthouse, pages) => {
  const rows = pages
    .map((page) => {
      const result = lighthouseFor(lighthouse, page.url);
      return `<tr><th scope="row">${escapeHtml(page.url)}</th>${renderMetricRow(result)}</tr>`;
    })
    .join('');

  return `<section>
    <h2>Lighthouse lab results</h2>
    <p>These numbers come from one desktop Chrome run per URL. Total Blocking Time is the lab stand-in for Interaction to Next Paint. This report does not include field data.</p>
    <div class="table-scroll" tabindex="0">
      <table>
        <caption>Lighthouse category scores and lab Core Web Vitals</caption>
        <thead>
          <tr>
            <th scope="col">URL</th>
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
        <tbody>${rows || '<tr><td colspan="11">No URLs were audited.</td></tr>'}</tbody>
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
      return `<tr>
        <td>${escapeHtml(issue.browsers.join(', '))}</td>
        <td>${escapeHtml(issue.impact)}</td>
        <td>${escapeHtml(issue.source)}</td>
        <td><code>${escapeHtml(issue.id)}</code></td>
        <td>${escapeHtml(issue.message)}${helpLink}</td>
        <td><code>${escapeHtml(issue.selector)}</code></td>
        <td>${escapeHtml(tags)}</td>
      </tr>`;
    })
    .join('');

  return `<div class="table-scroll" tabindex="0">
    <table>
      <caption>Issues grouped by rule, selector, and message. The browser column lists every engine that reported that row.</caption>
      <thead>
        <tr>
          <th scope="col">Browsers</th>
          <th scope="col">Impact</th>
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
      ? `Performance ${lab.scores.performance}, accessibility ${lab.scores.accessibility}, best practices ${lab.scores.bestPractices}, SEO ${lab.scores.seo}.`
      : '';

  return `<article>
    <h3>${pageHeading}</h3>
    ${labSummary ? `<p>${escapeHtml(labSummary)}</p>` : ''}
    ${errors.length ? `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}
    <details>
      <summary>${issues.length} engine issue${issues.length === 1 ? '' : 's'}, ${noteCount} keyboard note${noteCount === 1 ? '' : 's'}</summary>
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
