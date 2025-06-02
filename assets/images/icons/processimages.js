const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, 'raw');
const unactivatedDir = path.join(__dirname, 'unactivated');
const activatedDir = path.join(__dirname, 'activated');

async function processImage(rawPath, unactivatedPath, activatedPath) {
    try {
        const image = await Jimp.read(rawPath);

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];

            if (r === 0 && g === 0 && b === 0) {
                this.bitmap.data[idx + 0] = 100;
                this.bitmap.data[idx + 1] = 200;
                this.bitmap.data[idx + 2] = 255;
            }
        });

        await image.write(unactivatedPath);

        image.gaussian(2);

        await image.write(activatedPath);

        console.log('Done!');
    } catch (err) {
        console.error('Error: ' + err);
    }
}

fs.readdir(rawDir, (err, files) => {
    if (err) {
        return console.error('Unable to scan directory: ', err);
    }

    files.forEach(file => {
        const rawPath = path.join(rawDir, file);
        const unactivatedPath = path.join(unactivatedDir, file);
        const activatedPath = path.join(activatedDir, file);
        processImage(rawPath, unactivatedPath, activatedPath);
    });
});