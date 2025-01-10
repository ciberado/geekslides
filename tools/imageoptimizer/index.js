const fs = require('fs').promises;
const winston = require('winston');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.prettyPrint(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

logger.debug('Logger initialized');

const filePath = path.join(__dirname, 'sample.json');

async function loadData() {
        const data = await fs.readFile(filePath, 'utf8');
        const jsonObject = JSON.parse(data);
        return jsonObject;
}

async function downloadImages(data, directory) {
    await fs.mkdir(directory, { recursive: true });

    const downloadPromises = data.map(async (d) => {
        try {
            const response = await axios.get(d.src, { responseType: 'arraybuffer', timeout: 30*1000 });        
            const fileExtension = path.extname(d.src).toLowerCase();
            const fileName = d.alt ? 
                             d.alt.toLowerCase().split(',')[0].substring(0,40).toLowerCase().trim() :
                            path.basename(d.src, fileExtension);

            const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-') + fileExtension;
            const filePath = path.join(directory, sanitizedFileName);
            logger.debug(`Writing ${filePath}.`);
            await fs.writeFile(filePath, response.data);
            d.sanitizedFileName = sanitizedFileName;
        } catch (err) {
            logger.warn(`${JSON.stringify(d)} :: ${err.errors}.`)
            d.error = err;
        }
    });

    await Promise.all(downloadPromises);

    return data;
}

async function optimizeImage(fileName, inputDirectory, outputDirectory) {
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT= 1080;
    const QUALITY = 95;
    
    const inputPath = path.join(inputDirectory, fileName);
    const outputPath =  path.join(outputDirectory, fileName);


    if (fileName.match(/\.(jpg|jpeg)$/) === null) {
        await fs.copyFile(inputPath, outputPath);
        logger.warn(`File ${fileName} was not processed but just copied.`);
        return;
    }

    sharp(inputPath)
    .resize(MAX_WIDTH, MAX_HEIGHT, {
        fit : 'inside',
        withoutEnlargement : true
    }).jpeg({
        quality : QUALITY,
        progressive : true,
        force: false
    }) .toFile(outputPath, (err, info) => {
        if (err) {
          throw info;
        }
    });

    logger.info(`${fileName} processed.`);
}

async function optimizeImages(data, inputDirectory, outputDirectory) {
    await fs.mkdir(outputDirectory, { recursive: true });

    const optimizePromises = data.map(async (d) => optimizeImage(d.sanitizedFileName, inputDirectory, outputDirectory));

    await Promise.all(optimizePromises);

    return data;
}

async function main() {
    try {
        logger.info('Loading data.');
        let data = await loadData();
        /*
        data = [
            {
                "alt": "European Central Bank in Frankfurt, by Masood Aslami, https://www.pexels.com/photo/european-central-bank-in-frankfurt-19335898/",
                "src": "https://images.pexels.com/photos/19335902/pexels-photo-19335902/free-photo-of-skyline-of-frankfurt-am-main-and-autumnal-trees-germany.jpeg"
            }
        ];
        */
        logger.info('Downloading images.');
        data = await downloadImages(data, '/tmp/images/downloaded')
        logger.info('Compressing images.');
        await optimizeImages(data.filter(d=>d.sanitizedFileName), '/tmp/images/downloaded/', '/tmp/images/optimized/');
        logger.info('Saving data.');
        await fs.writeFile('/tmp/images/optimized/data.json', JSON.stringify(data, null, 2), 'utf8');

        logger.info(`Removing local paths from data.`);
        data.forEach(d => {
            if (d.src.startsWith('https://geekslides.aprender.cloud/xxx/')) {
                d.src = d.src.replace('https://geekslides.aprender.cloud/xxx/', '');
            }
        });

        logger.info('Updating README.md');
        const readmePath = '/home/ubuntu/projects/decks/xxx/slides/README.md';
        let readmeContent = await fs.readFile(readmePath, 'utf8');

        data.forEach(d => {
            const regex = new RegExp(d.src, 'g');
            readmeContent = readmeContent.replace(regex, `images/optimized/${d.sanitizedFileName}`);
        });

        await fs.writeFile(readmePath+'.v2', readmeContent, 'utf8');
        logger.info('All done.');

    } catch (err) {
        logger.error(err.stack);
    }    
}

main();