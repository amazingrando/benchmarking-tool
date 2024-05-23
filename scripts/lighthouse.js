import fs from 'fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import sites from '../urlsToTest.js';

const getLighthouseReport = async (site) => {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'html',
    port: chrome.port,
  };

  const runnerResult = await lighthouse(site, options);

  // `.report` is the HTML report as a string
  const reportHtml = runnerResult.report;
  fs.writeFileSync(
    `reports/${site
      .replace(/^https?:\/\//i, '')
      .replace('www.', '')
      .replace('.', '-')
      .replace(/\/+/g, '-')}-lhreport.html`,
    reportHtml,
  );

  // `.lhr` is the Lighthouse Result as a JS object
  console.log('🎉 Report is done for', runnerResult.lhr.finalDisplayedUrl);
  console.log(
    'Performance score was',
    runnerResult.lhr.categories.performance.score * 100,
  );

  chrome.kill();
};

sites
  .reduce(
    (chain, item) => chain.then(() => getLighthouseReport(item)),
    Promise.resolve(),
  )
  .then(() => console.log('All reports are finished.'));
