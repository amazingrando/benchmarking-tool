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

Edit `config.js` to modify the sites and viewport settings:

``` js
export const sites = ['URL_1', 'URL_2', 'URL_3'];

export const defaultViewports = [
  { width: 1200, isMobile: false },
  { width: 360, isMobile: true }
];
```

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
