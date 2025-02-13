# Benchmarking tool

The purpose of this tool is to take an array of URLs and create a series of reports to benchmark stats prior to working on a project.

We run the following as part of the audit:

* [Lighthouse](https://github.com/GoogleChrome/lighthouse/tree/main)
* [Pa11y](https://github.com/pa11y/pa11y)
* Take full-page screenshots at desktop and mobile sizes.

Reports are CSV files.

## How to use

### Installation

``` bash
npm install
```

You must have the [Google Chrome app](https://www.google.com/chrome/index.html) installed.

### Configuration

You can either manually edit `config.js` or generate it from a CSV file of URLs.

#### Manual Configuration

Edit `config.js` to modify the sites and viewport settings:

``` js
export const sites = ['URL_1', 'URL_2', 'URL_3'];

export const defaultViewports = [
  { width: 1200, isMobile: false },
  { width: 360, isMobile: true }
];
```

#### Generate from a Google Analytics CSV export

You can generate the config file from a Google Analytics CSV file containing URLs and their view counts. The script will take the top N most viewed URLs.

1. Prepare a CSV file (default name: `download.csv`) with columns for URLs and views. The column headers should contain either:
   - URLs: "location", "url", or "path"
   - Views: "views" (excluding columns with "per" in the name)

2. Run the generation script:

```bash
node scripts/generateSitesConfig.js [input.csv] [output.js]
```

Or

```bash
npm run config
```

The script will:

- Prompt you for how many top URLs you want to include
- Generate a config file with the most viewed URLs
- Use default viewport settings

Arguments are optional:

- Input file defaults to `download.csv`
- Output file defaults to `config.js`

### Viewport configuration

You can add as many viewport configurations as needed. Each viewport configuration requires:

* `width`: The viewport width in pixels
* `isMobile`: Boolean to indicate if it should use mobile device emulation

### Run reports and get screenshots

Get everything with this command.

``` bash
npm run everything
```

Get only audits.

``` bash
npm run audits
```

Get only screenshots.

``` bash
npm run screenshots
```

Remove old reports and screenshots

``` bash
npm run clean
```

All reports are saved to the `reports` directory.

All screenshots are saved in the `screenshots` directory as PNG files with the following naming convention:

* Desktop: `screenshot-[domain-name]--[width]-screen.png`
* Mobile: `screenshot-[domain-name]--[width]-mobile-screen.png`

## Screenshots

The screenshots are taken at the viewport sizes specified in `config.js`. By default, these are:

* Desktop: 1200px width
* Mobile: 360px width

Both screenshots are full-page captures that include all scrollable content. The script automatically scrolls the page to capture lazy-loaded content before taking the screenshot.

To modify the viewport sizes or add additional breakpoints, edit the `defaultViewports` array in `config.js`.
