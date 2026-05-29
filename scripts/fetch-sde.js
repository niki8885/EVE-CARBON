const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bz2 = require('unbzip2-stream');

const SDE_URL     = 'https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2';
const SDE_MD5_URL = 'https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2.md5';
const DATA_DIR    = path.join(__dirname, '../data');
const OUT_FILE    = path.join(DATA_DIR, 'sde.sql');
const MD5_FILE    = path.join(DATA_DIR, 'sde.md5');

async function fetchRemoteMd5() {
    const response = await axios.get(SDE_MD5_URL, { responseType: 'text' });
    // Fuzzwork md5 files are in the format: "<hash>  filename" — grab just the hash
    return response.data.trim().split(/\s+/)[0];
}

function readLocalMd5() {
    try { return fs.readFileSync(MD5_FILE, 'utf8').trim(); }
    catch { return null; }
}

async function downloadSDE() {
    console.log('Creating /data directory...');
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    console.log('Checking remote SDE version...');
    let remoteMd5;
    try {
        remoteMd5 = await fetchRemoteMd5();
        console.log(`Remote MD5 : ${remoteMd5}`);
    } catch (e) {
        console.warn(`Could not fetch remote MD5 (${e.message}), proceeding with download.`);
    }

    const localMd5 = readLocalMd5();
    console.log(`Local MD5  : ${localMd5 || '(none)'}`);

    if (remoteMd5 && localMd5 === remoteMd5 && fs.existsSync(OUT_FILE)) {
        console.log('SDE is already up to date. Skipping download.');
        return;
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

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log('SDE successfully downloaded and uncompressed to /data/sde.sql');

        // Save the MD5 so future runs can skip unnecessary downloads
        if (remoteMd5) {
            fs.writeFileSync(MD5_FILE, remoteMd5, 'utf8');
            console.log(`MD5 saved to ${MD5_FILE}`);
        }

    } catch (error) {
        console.error('Failed to download SDE:', error.message);
        process.exit(1);
    }
}

downloadSDE();