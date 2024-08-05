# Benchmarking tool

The purpose of this tool is to take an array of URLs and create a series of reports to benchmark stats prior to working on a project.

* [Lighthouse](https://github.com/GoogleChrome/lighthouse/tree/main) reports as HTML files.
* [Pa11y](https://github.com/pa11y/pa11y) reports as HTML files.
* Take screenshots.

## How to use

### Installation

``` bash
npm install
```

You must have the [Google Chrome app](https://www.google.com/chrome/index.html) installed.

### Set up array of URLs

Edit `urls.js` and modify the sites value:

``` js
const sites = ['URL_1', 'URL_2', 'URL_3'];
```

### Run reports and get screenshots

Get everything with this command.

``` node
npm run everything
```

Get only Lighthouse scores.

``` node
npm run lighthouse
```

Get only Pa11y reports.

``` node
npm run pa11y
```

Get only screenshots.

``` node
npm run screenshots
```

All reports are saved as HTML pages to the `reports` directory.

All screenshots are saved in the `screenshots` directory.

## How to modify reports

### Lighthouse

Modify the options in `scripts/lighthouse.js`. See a list of options in the [Lighthouse documentation](https://github.com/GoogleChrome/lighthouse/tree/main?tab=readme-ov-file#cli-options)

``` js
const options = {
  logLevel: 'info',
  output: 'html',
  port: chrome.port,
};
```

### Pa11y

This project doesn't have any options setup for Pa11y. You are welcome to edit the script for your own needs.

### Screenshots

The sizes for the screenshots are hard coded in the `screenshotLargeScreen` and `screenshotSmallScreen` functions.

A future update will make this configuration.
