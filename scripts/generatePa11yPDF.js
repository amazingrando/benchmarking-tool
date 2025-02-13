import fs from 'fs';
import path from 'path';
import pa11y from 'pa11y';
import PDFDocument from 'pdfkit';
import { sites } from '../config.js';

const REPORTS_DIR = 'reports/pa11y-pdf';

async function runPa11y(url) {
  try {
    console.log(`Running Pa11y audit for ${url}...`);
    const results = await pa11y(url, {
      timeout: 60000,
      wait: 1000, // Wait 1 second after page load
      chromeLaunchConfig: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });
    return results;
  } catch (error) {
    console.error(`Error running Pa11y for ${url}:`, error.message);
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
    const filename = `pa11y-${urlObj.hostname}${sanitizedPath ? `-${sanitizedPath}` : ''}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    const stream = fs.createWriteStream(outputPath);

    // Handle stream events
    stream.on('error', reject);
    stream.on('finish', () => resolve(outputPath));

    // Start creating the PDF
    doc.pipe(stream);

    // Add title
    doc.fontSize(20).text(`Pa11y Accessibility Report`, { align: 'center' });
    doc.fontSize(16).text(`URL: ${url}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    if (!results || results.issues.length === 0) {
      doc.text('No accessibility issues found.');
    } else {
      // Group issues by type
      const issuesByType = {
        error: results.issues.filter((issue) => issue.type === 'error'),
        warning: results.issues.filter((issue) => issue.type === 'warning'),
        notice: results.issues.filter((issue) => issue.type === 'notice'),
      };

      // Add summary
      doc.fontSize(16).text('Summary');
      doc
        .fontSize(12)
        .text(`Errors: ${issuesByType.error.length}`)
        .text(`Warnings: ${issuesByType.warning.length}`)
        .text(`Notices: ${issuesByType.notice.length}`);
      doc.moveDown();

      // Add detailed results
      doc.fontSize(16).text('Detailed Results');
      doc.moveDown();

      // Process each type of issue
      ['error', 'warning', 'notice'].forEach((type) => {
        if (issuesByType[type].length > 0) {
          doc
            .fontSize(14)
            .text(`${type.charAt(0).toUpperCase() + type.slice(1)}s`);
          doc.moveDown();

          issuesByType[type].forEach((issue, index) => {
            doc.fontSize(12).text(`${index + 1}. ${issue.message}`);
            doc
              .fontSize(10)
              .text(`Code: ${issue.code}`)
              .text(`Context: ${issue.context}`)
              .text(`Selector: ${issue.selector}`);
            doc.moveDown();
          });
        }
      });
    }

    doc.end();
  });
}

async function main() {
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  console.log('Starting Pa11y PDF report generation...');

  for (const url of sites) {
    const results = await runPa11y(url);
    if (results) {
      try {
        const outputPath = await generatePDF(results, url);
        console.log(`Generated PDF report for ${url} at ${outputPath}`);
      } catch (error) {
        console.error(`Error generating PDF for ${url}:`, error.message);
      }
    }
  }

  console.log('Finished generating Pa11y PDF reports!');
}

main().catch(console.error);
