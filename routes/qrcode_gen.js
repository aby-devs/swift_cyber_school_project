const express = require('express');
const route = express.Router();
const { admin } = require('../db/firebase_db');


route.get('/api/qr-code/:cafeId', async (req, res) => {
    const { cafeId } = req.params;
    
    if (!cafeId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Cafe ID is required' 
        });
    }

    try {
        // Reference to the QR code in storage
        const qrCodeRef = admin.storage().bucket().file(`qrcodes/${cafeId}/qr_code.png`);
        
        // Get signed URL with long expiration
        const [signedUrl] = await qrCodeRef.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'  // Long expiration date
        });

        // Also get cafe details for verification
        const cafeRef = admin.database().ref(`cafes/${cafeId}`);
        const snapshot = await cafeRef.once('value');
        const cafeData = snapshot.val();

        if (!cafeData) {
            return res.status(404).json({
                success: false,
                message: 'Cafe not found'
            });
        }

        res.json({
            success: true,
            qrCodeUrl: signedUrl,
            cafeName: cafeData.cafeName
        });

    } catch (error) {
        console.error('Error fetching QR code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve QR code',
            error: error.message
        });
    }
});

// Add download endpoint
route.get('/api/qr-code/:cafeId/download', async (req, res) => {
    const { cafeId } = req.params;
    
    if (!cafeId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Cafe ID is required' 
        });
    }

    try {
        const qrCodeRef = admin.storage().bucket().file(`qrcodes/${cafeId}/qr_code.png`);
        
        // Get the file
        const [exists] = await qrCodeRef.exists();
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: 'QR code not found'
            });
        }

        // Set response headers for file download
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename=${cafeId}_qr_code.png`);

        // Stream the file to response
        const readStream = qrCodeRef.createReadStream();
        readStream.pipe(res);

    } catch (error) {
        console.error('Error downloading QR code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download QR code',
            error: error.message
        });
    }
});


module.exports = route;
