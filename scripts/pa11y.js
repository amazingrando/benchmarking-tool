import fs from 'fs';
import pa11y from 'pa11y';
import htmlReporter from 'pa11y/lib/reporters/html.js';
import sites from '../urls.js';

const siteArray = sites.map((site) =>
  pa11y(site).then(async (results) => {
    const reportHtml = await htmlReporter.results(results);
    fs.writeFileSync(
      `reports/${site
        .replace(/^https?:\/\//i, '')
        .replace('www.', '')
        .replace('.', '-')
        .replace(/\/+/g, '-')}-pa11y-report.html`,
      reportHtml,
    );
  }),
);

async function pa11yFunction() {
  try {
    // Run tests against multiple URLs
    const results = await Promise.all(siteArray);

    // Output the raw result objects
    console.log(results[0]); // Results for the first URL
    console.log(results[1]); // Results for the second URL
  } catch (error) {
    console.error(error.message);
  }
}

pa11yFunction();
