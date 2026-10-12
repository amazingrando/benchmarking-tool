import { NAV_TIMEOUT_MS, NOTE_CAP, TAB_LIMIT } from './settings.js';

export const collectStructure = (page) =>
  page.evaluate(() => {
    const text = (element) =>
      (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);

    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .slice(0, 50)
      .map((element) => ({
        level: Number(element.tagName.slice(1)),
        text: text(element),
      }));

    const landmarks = [
      ...document.querySelectorAll(
        'header,nav,main,footer,aside,search,form,[role="banner"],[role="navigation"],[role="main"],[role="contentinfo"],[role="complementary"],[role="search"],[role="region"]',
      ),
    ]
      .slice(0, 40)
      .map((element) => ({
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        label:
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-labelledby') ||
          '',
      }));

    return { headings, landmarks };
  });

const describeFocus = () => {
  const element = document.activeElement;
  if (
    !element ||
    element === document.body ||
    element === document.documentElement
  ) {
    return null;
  }

  const style = getComputedStyle(element);
  const hasOutline =
    style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  const hasShadow = style.boxShadow !== 'none';
  const hasOffset = parseFloat(style.outlineOffset) !== 0;
  const name = (
    element.getAttribute('aria-label') ||
    element.getAttribute('alt') ||
    element.getAttribute('title') ||
    element.innerText ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  let selector = element.tagName.toLowerCase();
  if (element.id) selector += `#${CSS.escape(element.id)}`;
  else if (typeof element.className === 'string' && element.className.trim()) {
    const classes = element.className
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((className) => CSS.escape(className));
    selector += `.${classes.join('.')}`;
  }

  return {
    tag: element.tagName.toLowerCase(),
    name,
    selector,
    focusVisible: hasOutline || hasShadow || hasOffset,
  };
};

export const collectKeyboard = async (page) => {
  const sequence = [];
  const notes = [];
  let previous = '';
  let repeats = 0;

  await page.evaluate(() => {
    window.focus();
    document.body?.focus();
  });

  for (let step = 0; step < TAB_LIMIT; step += 1) {
    // Tab order has to be observed one key at a time.
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab');
    // eslint-disable-next-line no-await-in-loop
    const info = await page.evaluate(describeFocus);

    if (!info) {
      if (sequence.length) {
        notes.push({
          type: 'left-page',
          message: 'Focus left the page or returned to the document.',
        });
      }
      break;
    }

    const signature = `${info.selector}|${info.name}`;
    if (
      sequence.length > 1 &&
      signature === `${sequence[0].selector}|${sequence[0].name}`
    ) {
      break;
    }

    if (signature === previous) {
      repeats += 1;
      if (repeats >= 2) {
        notes.push({
          type: 'trap',
          message: `Focus stayed on ${info.selector}.`,
          selector: info.selector,
          name: info.name,
        });
        break;
      }
    } else {
      repeats = 0;
    }
    previous = signature;

    if (!info.focusVisible) {
      notes.push({
        type: 'invisible-focus',
        message: 'Focused element may have no visible indicator.',
        selector: info.selector,
        name: info.name,
      });
    }

    sequence.push({
      tag: info.tag,
      name: info.name,
      selector: info.selector,
    });
  }

  if (!sequence.length) {
    const focusable = await page.evaluate(
      () =>
        document.querySelector(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) !== null,
    );
    notes.push({
      type: 'no-focus',
      message: focusable
        ? 'Tab did not move focus onto an element. Focusable controls are present, so this browser may not be sending Tab to the page.'
        : 'Tab did not move focus onto an element in the page.',
    });
  }

  const priority = {
    trap: 0,
    'no-focus': 1,
    'left-page': 2,
    'invisible-focus': 3,
  };

  return {
    sequence,
    notes: notes
      .sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9))
      .slice(0, NOTE_CAP),
  };
};

export const collectReflow = (page) =>
  page.evaluate((cap) => {
    const root = document.documentElement;
    const overflow = root.scrollWidth > root.clientWidth + 1;
    const offenders = [];

    if (overflow) {
      [...document.body.querySelectorAll('*')].forEach((element) => {
        if (offenders.length >= cap) return;
        const rect = element.getBoundingClientRect();
        const tooSmall = rect.width < 2 || rect.height < 2;
        const inside = rect.right <= window.innerWidth + 1;
        const childOverflows = [...element.children].some((child) => {
          const childRect = child.getBoundingClientRect();
          return (
            childRect.width >= 2 && childRect.right > window.innerWidth + 1
          );
        });
        if (tooSmall || inside || childOverflows) return;

        let selector = element.tagName.toLowerCase();
        if (element.id) selector += `#${CSS.escape(element.id)}`;
        offenders.push({
          selector,
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      });
    }

    return {
      overflow,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders,
      screenshot: null,
    };
  }, NOTE_CAP);

export const collectReducedMotion = async (page, url) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });

  return page.evaluate((cap) => {
    const running = document.getAnimations().filter((animation) => {
      if (animation.playState !== 'running') return false;
      const duration = animation.effect?.getComputedTiming?.().duration;
      return duration !== 0;
    });

    const sample = running.slice(0, cap).map((animation) => {
      const target = animation.effect?.target;
      let selector = '';
      if (target?.nodeType === 1) {
        selector = target.tagName.toLowerCase();
        if (target.id) selector += `#${CSS.escape(target.id)}`;
      }
      const duration = animation.effect?.getComputedTiming?.().duration ?? null;
      return { selector, duration };
    });

    return { total: running.length, animations: sample };
  }, NOTE_CAP);
};
