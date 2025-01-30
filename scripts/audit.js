import fs from 'fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import pa11y from 'pa11y';
import { sites } from '../config.js';

// Utility function to create filename from URL
const createFilename = (url) =>
  url
    .replace(/^https?:\/\//i, '')
    .replace('www.', '')
    .replace('.', '-')
    .replace(/\/+/g, '-');

// Pa11y audit function
const runPa11y = async (url) => {
  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      runners: ['axe', 'htmlcs'],
    });

    console.log(`✅ Pa11y audit complete for ${url}`);
    return results.issues.length; // Return the number of issues
  } catch (error) {
    console.error(`❌ Error running Pa11y for ${url}:`, error);
    return 0; // Return 0 if there's an error
  }
};

// Lighthouse audit function
const runLighthouse = async (site, pa11yIssues) => {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  try {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(site, options);
    const scores = runnerResult.lhr.categories;

    // Create CSV data with Pa11y issues
    const scoreData = [
      site,
      Math.round(scores.performance.score * 100),
      Math.round(scores.accessibility.score * 100),
      Math.round(scores['best-practices'].score * 100),
      Math.round(scores.seo.score * 100),
      pa11yIssues, // Add Pa11y issues count
    ].join(',');

    // Handle CSV file
    const csvPath = 'reports/audit.csv';
    if (!fs.existsSync(csvPath)) {
      const header =
        'URL,Performance,Accessibility,Best Practices,SEO,Pa11y Issues\n';
      fs.writeFileSync(csvPath, header);
    }
    fs.appendFileSync(csvPath, `${scoreData}\n`);

    console.log(`✅ Lighthouse audit complete for ${site}`);
  } catch (error) {
    console.error(`❌ Error running Lighthouse for ${site}:`, error);
  } finally {
    await chrome.kill();
  }
};

// Main function to run both audits
async function runAccessibilityAudits() {
  console.log('🚀 Starting accessibility audits...\n');

  for (const site of sites) {
    console.log(`\n📋 Processing ${site}...`);
    // Run Pa11y first to get the number of issues
    const pa11yIssues = await runPa11y(site);
    // Pass the number of issues to Lighthouse
    await runLighthouse(site, pa11yIssues);
  }

  console.log('\n✨ All accessibility audits completed!');
}

// Run the audits
runAccessibilityAudits().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
