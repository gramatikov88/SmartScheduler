import fs from 'fs';
import https from 'https';
import path from 'path';

const fonts = [
    { url: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2', dest: 'public/fonts/Roboto-Regular.woff2' },
    { url: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.woff2', dest: 'public/fonts/Roboto-Bold.woff2' }
];

const download = (url, dest) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
        if (response.statusCode !== 200) {
            console.error(`Failed to download ${url}: ${response.statusCode}`);
            return;
        }
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${dest}`);
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => { });
        console.error(`Error downloading ${url}: ${err.message}`);
    });
};

if (!fs.existsSync('public/fonts')) {
    fs.mkdirSync('public/fonts', { recursive: true });
}

fonts.forEach(font => download(font.url, font.dest));
