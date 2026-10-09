import AxeBuilder from '@axe-core/playwright';
import { AXE_TAGS } from './settings.js';

const wcagTags = (tags) =>
  tags.filter((tag) => tag.startsWith('wcag') || tag.startsWith('section508'));

export const runAxe = async (page) => {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      source: 'axe',
      id: violation.id,
      impact: violation.impact ?? 'unknown',
      message: violation.help,
      description: violation.description,
      helpUrl: violation.helpUrl ?? '',
      tags: wcagTags(violation.tags),
      selector: node.target.join(' '),
      html: node.html ?? '',
    })),
  );
};
