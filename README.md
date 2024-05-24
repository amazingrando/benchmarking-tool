# Website stat runner

The purpose of this tool is to take an array of URLs and create a series of reports to benchmark stats prior to working on a project.

* [Lighthouse](https://github.com/GoogleChrome/lighthouse/tree/main) reports as HTML files.
* [pa11y](https://github.com/pa11y/pa11y) reports as HTML files.

## How to use

### Installation

``` bash
npm install
```

### Set up array of URLs

Edit `urls.js` and modify the sites value:

``` js
const sites = ['URL_1', 'URL_2', 'URL_3'];
```

### Run reports

``` node
npm run lighthouse
```

``` node
npm run pa11y
```

All reports are saved as HTML pages to the `reports` directory.

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

### pa11y

This project doesn't have any options setup for pa11y.
