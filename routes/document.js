const express = require('express');
const route = express.Router();
const firebaseAdmin = require('../db/firebase_db');
const admin = firebaseAdmin.admin;
const bucket = firebaseAdmin.bucket;


route.get('/documents/:cafeId', async (req, res) => {
    const { cafeId } = req.params;

    if (!cafeId) {
        return res.status(400).json({ error: 'No Cafe ID provided' });
    }

    try {
        const [files] = await bucket.getFiles({ prefix: `uploads/${cafeId}/` });
        
        const documentsPromises = files.map(async (file) => {
            try {
                const [metadata] = await file.getMetadata();
                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: '03-01-2500'
                });

                // Get creation time from Firebase Storage metadata
                const creationTime = new Date(metadata.timeCreated);
                
                // Format the date for display, explicitly setting the timezone to UTC+3
                const formattedDate = new Date(creationTime.getTime()).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                    timeZone: 'Africa/Nairobi' // This will ensure UTC+3 timezone
                });

                return {
                    name: metadata.metadata.originalFileName || file.name,
                    url,
                    senderName: metadata.metadata.senderName || 'Unknown Sender',
                    uploadDate: formattedDate,
                    timeStamp: creationTime.getTime()
                };
            } catch (error) {
                console.error(`Error fetching document ${file.name}:`, error);
                return null;
            }
        });

        const documents = (await Promise.all(documentsPromises))
            .filter(doc => doc !== null)
            .sort((a, b) => b.timeStamp - a.timeStamp);

        res.json({ documents });

    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
});


// Add a cleanup function that runs periodically
async function cleanupExpiredFiles() {
    try {
        const now = new Date();
        
        // Query for expired documents
        const snapshot = await admin.firestore()
            .collection('uploads')
            .where('expirationTime', '<=', now)
            .get();

        if (snapshot.empty) {
            return;
        }

        // Delete expired files and documents
        const deletePromises = snapshot.docs.map(async (doc) => {
            const data = doc.data();
            try {
                // Delete from Storage
                const fileRef = bucket.file(data.filePath);
                await fileRef.delete();

                // Delete from Firestore
                await doc.ref.delete();
                
                console.log(`Deleted expired file: ${data.fileName}`);
            } catch (error) {
                console.error(`Error deleting ${data.fileName}:`, error);
            }
        });

        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Run cleanup every 30 seconds
setInterval(cleanupExpiredFiles, 30 * 1000);




module.exports = route;
