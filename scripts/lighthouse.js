import fs from 'fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import sites from '../urlsToTest.js';

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

sites.map(async (site) => {
  const options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse(site, options);

  // `.report` is the HTML report as a string
  const reportHtml = runnerResult.report;
  fs.writeFileSync(
    `reports/${site
      .replace(/^https?:\/\//i, '')
      .replace('www.', '')
      .replace('.', '-')}-lhreport.html`,
    reportHtml,
  );

  // `.lhr` is the Lighthouse Result as a JS object
  console.log('🎉 Report is done for', runnerResult.lhr.finalDisplayedUrl);
  console.log(
    'Performance score was',
    runnerResult.lhr.categories.performance.score * 100,
  );

  chrome.kill();
});
