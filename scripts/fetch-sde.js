const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bz2 = require('unbzip2-stream');

const SDE_URL = 'https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2';
const DATA_DIR = path.join(__dirname, '../data');
const OUT_FILE = path.join(DATA_DIR, 'sde.sql');

async function downloadSDE() {
    console.log('Creating /data directory...');
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    console.log(`Downloading latest Fuzzwork SDE from ${SDE_URL}...`);
    
    try {
        const response = await axios({
            method: 'get',
            url: SDE_URL,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(OUT_FILE);

        // Pipe the download through the bz2 decompressor and into the file
        response.data.pipe(bz2()).pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log('SDE successfully downloaded and uncompressed to /data/sde.sql');
                resolve();
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Failed to download SDE:', error.message);
        process.exit(1);
    }
}

downloadSDE();