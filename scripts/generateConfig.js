import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import readline from 'readline';

const DEFAULT_INPUT = 'download.csv';
const DEFAULT_OUTPUT = 'config.js';
const DEFAULT_TOP_N = 20;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptForTopN() {
  return new Promise((resolve) => {
    rl.question(
      `How many top URLs would you like? (default: ${DEFAULT_TOP_N}): `,
      (answer) => {
        rl.close();
        const num = parseInt(answer, 10);
        // Validate the input
        if (isNaN(num) || num < 1) {
          console.log(`Invalid input, using default value: ${DEFAULT_TOP_N}`);
          resolve(DEFAULT_TOP_N);
        } else {
          resolve(num);
        }
      },
    );
  });
}

async function generateSitesConfig(inputFilePath, outputFilePath) {
  console.log(
    `Starting generateSitesConfig with input: ${inputFilePath}, output: ${outputFilePath}`,
  );
  try {
    let sites = [];

    if (!fs.existsSync(inputFilePath)) {
      console.log(
        `Input file ${inputFilePath} not found. Proceeding with empty sites array.`,
      );
      rl.close(); // Close readline if we're not going to use it
    } else {
      console.log('Found input CSV file, processing...');
      const topN = await promptForTopN();
      console.log(`Will process top ${topN} URLs`);

      // Read and parse the CSV file
      const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
      let records;
      try {
        records = parse(fileContent);
      } catch (e) {
        console.error('Failed to parse CSV file:', e.message);
        return;
      }

      if (records.length < 2) {
        console.log(
          'CSV file is empty or contains only headers. Proceeding with empty sites array.',
        );
        return;
      }

      // Get header row and find column indices
      const header = records[0].map((col) => col.toLowerCase().trim());
      const viewsIndex = header.findIndex(
        (col) => col.includes('views') && !col.includes('per'),
      );
      const urlIndex = header.findIndex(
        (col) =>
          col.includes('location') ||
          col.includes('url') ||
          col.includes('path'),
      );

      console.log(`Found columns - Views: ${viewsIndex}, URL: ${urlIndex}`);

      if (viewsIndex === -1 || urlIndex === -1) {
        console.error('Could not find Views or URL column in CSV');
        return;
      }

      // Process records in a single pass
      sites = records
        .slice(1) // Skip header
        .map((row) => ({
          url: row[urlIndex]?.trim(),
          views: parseInt(row[viewsIndex], 10),
        }))
        .filter((item) => item.url && !isNaN(item.views)) // Filter out invalid entries
        .sort((a, b) => b.views - a.views) // Sort by views descending
        .slice(0, topN) // Take top N
        .map((item) => item.url); // Get just the URLs

      console.log(
        `Processed ${records.length - 1} rows, found ${sites.length} valid entries`,
      );
    }

    console.log('Generating config file content...');
    // Generate the config file content
    const configContent = `export const sites = [
${sites.length > 0 ? sites.map((site) => `  '${site}',`).join('\n') : ''}
];

export const defaultViewports = [
  { width: 1200, isMobile: false },
  { width: 360, isMobile: true },
];
`;

    // Ensure output directory exists
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing to ${outputFilePath}...`);
    fs.writeFileSync(outputFilePath, configContent);
    console.log(`Generated config with ${sites.length} sites`);
    console.log(`Saved to ${outputFilePath}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Command line handling
const args = process.argv.slice(2);
const inputPath = args[0] || DEFAULT_INPUT;
const outputPath = args[1] || DEFAULT_OUTPUT;

// Properly handle the async function
generateSitesConfig(inputPath, outputPath).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

export default generateSitesConfig;
