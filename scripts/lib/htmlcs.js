import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const htmlcsPath = require.resolve('html_codesniffer/build/HTMLCS.js');

const TYPE_NAMES = {
  1: 'error',
  2: 'warning',
  3: 'notice',
};

export const runHtmlcs = async (page) => {
  await page.addScriptTag({ path: htmlcsPath });

  return page.evaluate((typeNames) => {
    const describe = (element) => {
      const node =
        element?.nodeType === 1 ? element : (element?.parentElement ?? null);
      if (!node) return '';
      let selector = node.tagName.toLowerCase();
      if (node.id) selector += `#${CSS.escape(node.id)}`;
      else if (typeof node.className === 'string' && node.className.trim()) {
        const classes = node.className
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((className) => CSS.escape(className));
        selector += `.${classes.join('.')}`;
      }
      return selector;
    };

    return new Promise((resolve, reject) => {
      if (!window.HTMLCS?.process) {
        reject(new Error('HTML_CodeSniffer did not load.'));
        return;
      }

      window.HTMLCS.process(
        'WCAG2AA',
        document,
        () => {
          const messages = window.HTMLCS.getMessages();
          resolve(
            messages.map((message) => ({
              source: 'htmlcs',
              id: message.code,
              impact: typeNames[message.type] || 'notice',
              message: message.msg,
              description: '',
              helpUrl: '',
              tags: ['WCAG2AA'],
              selector: describe(message.element),
              html: '',
            })),
          );
        },
        () => {
          reject(new Error('HTML_CodeSniffer failed to load WCAG2AA.'));
        },
      );
    });
  }, TYPE_NAMES);
};
