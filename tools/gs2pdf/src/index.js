import fs from 'fs';
import pino from 'pino';
import { firefox } from 'playwright';
import PDFDocument from 'pdfkit';

// npx playwright install-deps
// npx playwright install firefox

const logger = pino({
  level : 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
    },
  },
});

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

if (process.argv.length < 4) {
  logger.error('Usage: node index.js <server-url> <presentation-url>');
  process.exit(1);
}

const serverUrl = process.argv[2];
const presentationUrl = process.argv[3];

logger.info(`Loading ${presentationUrl} from ${serverUrl}.`);
logger.info('Starting browser context.');

const browser = await firefox.launch({ headless: true }); // Set headless to false to see the browser
const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }     
});

logger.info('Loading presentation.');
const page = await context.newPage();
await page.goto(`${serverUrl}/?url=${presentationUrl}`); 
await page.waitForLoadState('load'); 

logger.info('Creating output directory.');
const workdir= '/tmp/gs';
fs.rmSync(workdir, { recursive: true, force: true });
fs.mkdirSync(workdir, { recursive: true });

logger.info('Starting processing slides.');
let slideIndex = 0;
let lastHash = '';
let currentHash;

do {
    await sleep(1000);
    const screenshotName = `${workdir}/${String(slideIndex).padStart(3, '0')}.png`;
    logger.info(`Screenshot: ${screenshotName}.`);
    await page.screenshot({ path: screenshotName }); 
    lastHash = await page.evaluate(() => document.location.hash);
    logger.debug(`lastHash: ${lastHash}.`);
    await page.evaluate(() => {
        const event = new CustomEvent('nextSlide', {  cancelable: true, bubbles: false }); 
        document.dispatchEvent(event);
    });
    await sleep(1000);
    currentHash = await page.evaluate(() => document.location.hash);
    logger.debug(`currentHash: ${currentHash}.`);
    slideIndex++;
} while(lastHash !== currentHash);

await browser.close(); // Close the browser when done

logger.info ('Creating pdf.');

const doc = new PDFDocument({
  size: [1440, 810], // 1920x1080 px  
  margins: { top: 0, bottom: 0, left: 0, right: 0 } // Remove margins
});

doc.pipe(fs.createWriteStream(`${workdir}/output.pdf`));

for (let i=0; i < slideIndex; i++) {
  if (i > 0) {
    doc.addPage();
  }
  const screenshotName = `${workdir}/${String(i).padStart(3, '0')}.png`;
  logger.info(`Adding page ${screenshotName}.`);
  doc.image(screenshotName, {
    fit : [1440, 810],
    align : 'center',
    valign : 'center'
  });
  logger.info(`Deleting ${screenshotName}.`);
  fs.unlinkSync(screenshotName);
}

doc.end();

logger.info('All done.');