# Lighthouse CLI runner

The purpose of this tool is to take an array of URLs and create a series of [Lighthouse](https://github.com/GoogleChrome/lighthouse/tree/main) reports as HTML files.

## How to use

### Installation

``` bash
npm install
```

### Set up array of URLs

Edit `urlsToTest.js` and modify the sites value:

``` js
const sites = ['URL_1', 'URL_2', 'URL_3'];
```

### Run reports

``` node
npm run lighthouse
```

All reports are saved as HTML pages to the `reports` directory.

## How to modify reports

Modify the options in `scripts/lighthouse.js`. See a list of options in the [Lighthouse documentation](https://github.com/GoogleChrome/lighthouse/tree/main?tab=readme-ov-file#cli-options)

``` js
const options = {
  logLevel: 'info',
  output: 'html',
  onlyCategories: ['performance'],
  port: chrome.port,
};
```
