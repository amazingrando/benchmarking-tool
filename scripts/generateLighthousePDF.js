import fs from 'fs';
import path from 'path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import PDFDocument from 'pdfkit';
import { sites } from '../config.js';

const REPORTS_DIR = 'reports/lighthouse-pdf';

async function runLighthouse(url) {
  try {
    console.log(`Running Lighthouse audit for ${url}...`);
    const chrome = await launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const options = {
      logLevel: 'verbose',
      output: 'json',
      port: chrome.port,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    };

    const results = await lighthouse(url, options);
    await chrome.kill();
    return results.lhr;
  } catch (error) {
    console.error(`Error running Lighthouse for ${url}:`, error.message);
    return null;
  }
}

function generatePDF(results, url) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const urlObj = new URL(url);
    const sanitizedPath = urlObj.pathname
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `lighthouse-${urlObj.hostname}${sanitizedPath ? `-${sanitizedPath}` : ''}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    const stream = fs.createWriteStream(outputPath);

    stream.on('error', reject);
    stream.on('finish', () => resolve(outputPath));

    doc.pipe(stream);

    // Title and URL
    doc.fontSize(20).text('Lighthouse Performance Report', { align: 'center' });
    doc.fontSize(16).text(`URL: ${url}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    if (!results) {
      doc.text('Error generating Lighthouse report.');
    } else {
      // Overall Scores
      doc.fontSize(16).text('Performance Scores');
      doc.moveDown();

      const categories = [
        'performance',
        'accessibility',
        'best-practices',
        'seo',
      ];
      categories.forEach((category) => {
        const score = Math.round(results.categories[category].score * 100);
        doc
          .fontSize(12)
          .text(
            `${category.charAt(0).toUpperCase() + category.slice(1)}: ${score}%`,
          );

        // Add audit details for each category
        doc.moveDown(0.5);
        const categoryAudits = results.categories[category].auditRefs
          .map((ref) => results.audits[ref.id])
          .filter((audit) => audit.score !== null && audit.score < 1); // Show only failed audits

        if (categoryAudits.length > 0) {
          doc.fontSize(10).text('Issues found:', { underline: true });
          categoryAudits.forEach((audit) => {
            const score = Math.round(audit.score * 100) || 0;
            doc
              .fontSize(10)
              .text(`• ${audit.title} (${score}%)`, { continued: true });
            doc.fontSize(9).text(`: ${audit.description}`, { color: 'grey' });
          });
        } else {
          doc.fontSize(10).text('No issues found', { color: 'green' });
        }
        doc.moveDown();
      });
      doc.moveDown();

      // Detailed Metrics
      doc.fontSize(16).text('Core Web Vitals');
      doc.moveDown();

      const metrics = [
        {
          key: 'first-contentful-paint',
          label: 'First Contentful Paint (FCP)',
        },
        {
          key: 'largest-contentful-paint',
          label: 'Largest Contentful Paint (LCP)',
        },
        { key: 'total-blocking-time', label: 'Total Blocking Time (TBT)' },
        {
          key: 'cumulative-layout-shift',
          label: 'Cumulative Layout Shift (CLS)',
        },
        { key: 'speed-index', label: 'Speed Index' },
        { key: 'interactive', label: 'Time to Interactive' },
      ];

      metrics.forEach((metric) => {
        const metricData = results.audits[metric.key];
        if (metricData) {
          doc.fontSize(12).text(`${metric.label}: ${metricData.displayValue}`);
        }
      });
    }

    doc.end();
  });
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  console.log('Starting Lighthouse PDF report generation...');

  for (const url of sites) {
    const results = await runLighthouse(url);
    if (results) {
      try {
        const outputPath = await generatePDF(results, url);
        console.log(`Generated PDF report for ${url} at ${outputPath}`);
      } catch (error) {
        console.error(`Error generating PDF for ${url}:`, error.message);
      }
    }
  }

  console.log('Finished generating Lighthouse PDF reports!');
}

main().catch(console.error);
