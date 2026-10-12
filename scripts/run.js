import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium, firefox, webkit } from 'playwright';
import { auditUrl } from './lib/browserPass.js';
import { slugFromUrl } from './lib/filename.js';
import { runLighthouseAudit } from './lib/lighthouse.js';
import { renderReport } from './lib/reportHtml.js';
import { createRunDir, latestRunDir } from './lib/runDir.js';
import { loadSettings } from './lib/settings.js';

const launchers = { chromium, firefox, webkit };

const launchOptions = (browserName) => {
  if (browserName !== 'firefox') return { options: {} };
  // macOS 27 blocks this Firefox from ~/Library/Application Support/Firefox.
  const home = fs.mkdtempSync(
    path.join(os.tmpdir(), 'benchmark-firefox-home-'),
  );
  return {
    home,
    options: { env: { ...process.env, CFFIXED_USER_HOME: home } },
  };
};

const removeFirefoxHome = (home) => {
  if (!home) return;
  try {
    execFileSync('chmod', ['-R', '-N', home], { stdio: 'ignore' });
  } catch {
    // chmod -N clears the macOS "deny delete" flag Firefox sets. Other systems skip it.
  }
  try {
    fs.rmSync(home, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    console.log(`Could not remove Firefox home ${home}: ${error.message}`);
  }
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const writeJson = (file, value) => {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const writeReport = (runDir, lighthouse, a11y) => {
  const output = path.join(runDir, 'report.html');
  fs.writeFileSync(output, renderReport({ lighthouse, a11y }));
  return output;
};

const rebuild = () => {
  const runDir = latestRunDir();
  if (!runDir) {
    console.error('No run JSON found in reports/.');
    process.exit(1);
  }

  const a11yPath = path.join(runDir, 'a11y.json');
  const lighthousePath = path.join(runDir, 'lighthouse.json');
  if (!fs.existsSync(a11yPath)) {
    console.error(`No a11y.json in ${runDir}.`);
    process.exit(1);
  }

  const a11y = readJson(a11yPath);
  const lighthouse = fs.existsSync(lighthousePath)
    ? readJson(lighthousePath)
    : { generatedAt: a11y.generatedAt, results: [] };
  const output = writeReport(runDir, lighthouse, a11y);
  console.log(`Wrote ${output}`);
};

const main = async () => {
  const reportOnly = process.argv.includes('--report-only');
  const screenshotsOnly = process.argv.includes('--screenshots-only');

  if (reportOnly) {
    rebuild();
    return;
  }

  const settings = loadSettings();
  const unknown = settings.browsers.filter((name) => !launchers[name]);
  if (unknown.length) {
    console.error(
      `Unknown browsers: ${unknown.join(', ')}. Use chromium, firefox, or webkit.`,
    );
    process.exit(1);
  }

  if (!settings.sites.length) {
    console.error(
      'No sites in config.js. Add URLs or run npm run config to generate them.',
    );
    process.exit(1);
  }

  const runDir = createRunDir();
  const generatedAt = new Date().toISOString();
  const lighthouse = { generatedAt, results: [] };

  if (!screenshotsOnly) {
    for (const url of settings.sites) {
      console.log(`Lighthouse: ${url}`);
      // Lighthouse uses one Chrome instance at a time.
      // eslint-disable-next-line no-await-in-loop
      const result = await runLighthouseAudit(url);
      lighthouse.results.push(result);
      if (result.error) {
        console.log(`Lighthouse error for ${url}: ${result.error}`);
      } else {
        console.log(`Lighthouse complete for ${url}`);
      }
    }
    writeJson(path.join(runDir, 'lighthouse.json'), lighthouse);
  }

  const pages = settings.sites.map((url) => ({
    url,
    slug: slugFromUrl(url),
    browsers: [],
  }));

  for (const browserName of settings.browsers) {
    console.log(`Launching ${browserName}`);
    let browser;
    const { home: firefoxHome, options } = launchOptions(browserName);
    try {
      // eslint-disable-next-line no-await-in-loop
      browser = await launchers[browserName].launch(options);
    } catch (error) {
      removeFirefoxHome(firefoxHome);
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Could not launch ${browserName}: ${message}`);
      for (const page of pages) {
        page.browsers.push({
          browser: browserName,
          error: message,
          engineErrors: [],
          issues: [],
          structure: { headings: [], landmarks: [] },
          keyboard: { sequence: [], notes: [] },
          reflow: null,
          reducedMotion: null,
          screenshots: [],
        });
      }
      // eslint-disable-next-line no-continue
      continue;
    }

    try {
      for (const page of pages) {
        console.log(`${browserName}: ${page.url}`);
        // eslint-disable-next-line no-await-in-loop
        const result = await auditUrl({
          browser,
          browserName,
          url: page.url,
          runDir,
          viewports: settings.viewports,
          screenshotsOnly,
        });
        page.browsers.push(result);
        if (result.error) {
          console.log(`${browserName} error for ${page.url}: ${result.error}`);
        } else {
          console.log(`${browserName} complete for ${page.url}`);
        }
      }
    } finally {
      await browser.close();
      removeFirefoxHome(firefoxHome);
    }
  }

  const a11y = {
    generatedAt,
    browsers: settings.browsers,
    viewports: settings.viewports,
    screenshotsOnly,
    pages,
  };
  writeJson(path.join(runDir, 'a11y.json'), a11y);
  const output = writeReport(runDir, lighthouse, a11y);
  console.log(`Wrote ${output}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
