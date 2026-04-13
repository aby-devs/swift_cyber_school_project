const { createCanvas, loadImage } = require('canvas');
const { bucket } = require('../db/firebase_db');

async function generateQRCode(uniqueId) {
    try {
        // const cafeUrl = `https://mycyberswift.com/upload?cafeId=${uniqueId}`;
        // const cafeUrl = `http://localhost:4000/upload?cafeId=${uniqueId}`;
        const cafeUrl = `https://swift-cyber-school-project.onrender.com/upload?cafeId=${uniqueId}`;
        //const cafeUrl = `https://noisy-rough-market.glitch.me/upload.html?cafeId=${uniqueId}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(cafeUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let response;
        try {
            response = await fetch(qrCodeUrl, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        const buffer = Buffer.from(await response.arrayBuffer());

        const canvas = createCanvas(250, 250);
        const ctx = canvas.getContext('2d');
        const img = await loadImage(buffer);

        ctx.drawImage(img, 0, 0, 250, 250);
        const qrCodeBuffer = canvas.toBuffer('image/png');

        const file = bucket.file(`qrcodes/${uniqueId}/qr_code.png`);
        await file.save(qrCodeBuffer, {
            metadata: {
                contentType: 'image/png'
            }
        });

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'
        });

        return url;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
}



module.exports = { generateQRCode };
