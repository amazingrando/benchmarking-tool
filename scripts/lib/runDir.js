import fs from 'fs';
import path from 'path';

const REPORTS_ROOT = 'reports';

export const createRunDir = () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(REPORTS_ROOT, stamp);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
};

export const latestRunDir = () => {
  if (!fs.existsSync(REPORTS_ROOT)) return null;

  const runs = fs
    .readdirSync(REPORTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const dir = path.join(REPORTS_ROOT, name);
      return (
        fs.existsSync(path.join(dir, 'a11y.json')) ||
        fs.existsSync(path.join(dir, 'lighthouse.json'))
      );
    })
    .sort();

  if (!runs.length) return null;
  return path.join(REPORTS_ROOT, runs.at(-1));
};
