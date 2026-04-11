const express = require('express');
const route = express.Router();
const { bucket, admin } = require('../db/firebase_db');


route.delete('/clear-dashboard/:cafeId', async (req, res) => {
    const { cafeId } = req.params;

    if (!cafeId) {
        return res.status(400).json({ error: 'No Cafe ID provided' });
    }

    try {
        // Get all files in the cafe's upload directory
        const [files] = await bucket.getFiles({ prefix: `uploads/${cafeId}/` });
        
        // Delete all files from Storage
        const deletePromises = files.map(async (file) => {
            try {
                await file.delete();
                
                // Also delete the corresponding Firestore document
                const snapshot = await admin.firestore()
                    .collection('uploads')
                    .where('filePath', '==', file.name)
                    .get();
                
                snapshot.docs.forEach(async (doc) => {
                    await doc.ref.delete();
                });
                
            } catch (error) {
                console.error(`Error deleting ${file.name}:`, error);
            }
        });

        await Promise.all(deletePromises);
        res.json({ success: true, message: 'Dashboard cleared successfully' });

    } catch (error) {
        console.error('Error clearing dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

route.get('/get-qr-code', async (req, res) => {
    const uniqueId = req.cookies.uniqueId;

    if (!uniqueId) {
        return res.status(400).json({ message: 'Unique ID not found.' });
    }

    try {
        const db = admin.database();
        const cafeRef = db.ref(`cafes/${uniqueId}`);
        const snapshot = await cafeRef.once('value');
        const cafeData = snapshot.val();

        if (cafeData && cafeData.qrCodeUrl) {
            res.json({ qrCodeUrl: cafeData.qrCodeUrl });
        } else {
            res.status(404).json({ message: 'QR Code not found' });
        }
    } catch (error) {
        console.error('QR Code Retrieval Error:', error);
        res.status(500).json({ message: 'Failed to retrieve QR code', error: error.message });
    }
});

// Get unique ID endpoint
route.get('/get-unique-id', (req, res) => {
    const uniqueId = req.cookies.uniqueId;

    if (!uniqueId) {
        return res.status(400).json({ message: 'Unique ID not found.' });
    }

    res.json({ uniqueId });
});





module.exports = route;
