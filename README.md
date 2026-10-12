[![](https://github.com/amazingrando/amazingrando/blob/master/assets/amazing-rando-badge.svg)](https://amazingrando.com)

# Benchmarking tool

The purpose of this tool is to take an array of URLs and create a report to benchmark a site.

One run does the following:

* [Lighthouse](https://github.com/GoogleChrome/lighthouse/tree/main) in desktop Chrome: performance, accessibility, best practices, and SEO, plus lab Core Web Vitals.
* [axe-core](https://github.com/dequelabs/axe-core) WCAG 2.2 AA and [HTML_CodeSniffer](https://github.com/squizlabs/HTML_CodeSniffer) WCAG 2.0 AA in Chromium, Firefox, and WebKit.
* Heading outline, landmarks, a keyboard tab pass, a 320px reflow check, and a reduced-motion check in each of those browsers.
* Full-page screenshots at the configured viewport widths in each browser.

The run always finishes and writes a report. Findings do not fail the process. Lighthouse numbers are lab results. Total Blocking Time is the lab stand-in for Interaction to Next Paint, not field data.

## How to use

### Installation

```bash
npm install
npx playwright install chromium firefox webkit
```

You must have the [Google Chrome app](https://www.google.com/chrome/index.html) installed. Lighthouse launches that Chrome. Playwright uses its own Chromium, Firefox, and WebKit for the accessibility checks and screenshots.

### Configuration

`config.js` is local and is not committed. Copy the example, then edit it or generate it from a CSV file of URLs.

```bash
cp config.example.js config.js
```

#### Manual configuration

```js
export const sites = ['URL_1', 'URL_2', 'URL_3'];

export const defaultViewports = [
  { width: 1200, isMobile: false },
  { width: 360, isMobile: true },
];

// Optional. Defaults to Chromium, Firefox, and WebKit.
export const browsers = ['chromium', 'firefox', 'webkit'];

// Optional. How many times to run Lighthouse for each URL. Defaults to 6.
export const lighthouseRuns = 6;
```

Each viewport needs:

* `width`: viewport width in pixels
* `isMobile`: `true` uses a mobile device context for that screenshot

Pages are loaded as they are. The run does not log in and does not dismiss cookie banners.

#### Generate from a Google Analytics CSV export

The generator takes the top N most viewed URLs from a CSV export.

1. Prepare a CSV file (default name: `download.csv`) with columns for URLs and views. Headers should contain either:
   - URLs: "location", "url", or "path"
   - Views: "views" (columns with "per" in the name are ignored)

2. Run:

```bash
npm run config
```

Or pass paths:

```bash
node scripts/generateConfig.js [input.csv] [output.js]
```

The script prompts for how many top URLs to include. The input defaults to `download.csv` and the output defaults to `config.js`.

### Run

Run Lighthouse, the cross-browser checks, screenshots, and the HTML report:

```bash
npm run everything
```

`npm run audit` is the same command.

Screenshots only, still in all configured browsers:

```bash
npm run screenshots
```

Rebuild `report.html` from the newest JSON without launching browsers:

```bash
npm run report
```

Remove old reports:

```bash
npm run clean
```

## Output

Each run writes a folder:

```text
reports/2026-10-09T18-11-00-000Z/
  lighthouse.json
  a11y.json
  report.html
  screenshots/{chromium,firefox,webkit}/...
```

Open `report.html` in a browser. It links to the screenshots with relative paths.

Screenshot files live under `screenshots/{browser}/`:

* Desktop: `{slug}--{width}.png`
* Mobile: `{slug}--{width}-mobile.png`
* Reflow evidence, only when a page overflows at 320 CSS pixels: `{slug}--320-reflow.png`

`lighthouse.json` holds the desktop Chrome scores, lab metrics, and the failed audits for performance, accessibility, best practices, and SEO. Scores and lab metrics include the minimum, median, and maximum across the configured number of runs. Each failed audit includes its title, score, and the recommendation for what to change. Recommendations come from the run closest to the median performance score.

`a11y.json` holds, per URL and browser:

* axe-core violations for the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa`
* HTML_CodeSniffer `WCAG2AA` messages, tagged as a second opinion (that standard does not cover every WCAG 2.2 criterion)
* Heading and landmark lists
* Keyboard sequence and notes (possible focus traps, focus that leaves the page, and focused elements with no outline, box-shadow, or offset)
* Reflow at 320 CSS pixels, the usual stand-in for 1280px at 400% zoom
* Animations still running after `prefers-reduced-motion: reduce`

Keyboard, reflow, and reduced-motion notes are heuristics. They are stored apart from the engine issues and are not WCAG verdicts.

A navigation timeout is 60 seconds. A timeout or crash is recorded in the report and the run continues with the next URL or browser.
