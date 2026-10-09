const SCROLL_STEPS = 100;
const SCROLL_DELAY_MS = 50;
const SETTLE_MS = 1000;

export const scrollPage = async (page) => {
  await page.evaluate(
    async ({ steps, delayMs, settleMs }) => {
      const wait = (ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        });

      window.scrollTo(0, 0);
      let previous = -1;

      for (let step = 0; step < steps; step += 1) {
        window.scrollBy(0, Math.max(window.innerHeight, 400));
        // Lazy-loaded images need a beat between scroll positions.
        // eslint-disable-next-line no-await-in-loop
        await wait(delayMs);
        if (window.scrollY === previous) break;
        previous = window.scrollY;
      }

      await wait(settleMs);
      window.scrollTo(0, 0);
    },
    { steps: SCROLL_STEPS, delayMs: SCROLL_DELAY_MS, settleMs: SETTLE_MS },
  );
};
