const express = require('express');
const route = express.Router();
const multer = require('multer');
const upload = multer();
const firebaseAdmin = require('../db/firebase_db');
const admin = firebaseAdmin.admin;
const bucket = firebaseAdmin.bucket;


route.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { cafeId, senderName } = req.body;
        if (!cafeId || !senderName) {
            return res.status(400).json({ error: 'Missing cafeId or senderName' });
        }

        // Process all files concurrently using Promise.all
        const uploadPromises = req.files.map(async (file) => {
            try {
                const fileName = `${file.originalname}`;
                const filePath = `uploads/${cafeId}/${fileName}`;
                const fileUpload = bucket.file(filePath);

                const metadata = {
                    metadata: {
                        senderName: senderName,
                        cafeId: cafeId,
                        originalFileName: file.originalname,
                        uploadDate: new Date().toISOString(),
                        expirationTime: (Date.now() + (60 * 60 * 1000)).toString() // 1 hour expiration
                    },
                    contentType: file.mimetype,
                };

                // Upload file to Firebase Storage
                await fileUpload.save(file.buffer, {
                    metadata: metadata
                });

                // Get download URL
                const [url] = await fileUpload.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + (60 * 60 * 1000) // 1 hour expiration
                });

                // Store in Firestore
                const docRef = await admin.firestore().collection('uploads').add({
                    fileName: fileName,
                    originalFileName: file.originalname,
                    senderName: senderName,
                    cafeId: cafeId,
                    uploadDate: admin.firestore.FieldValue.serverTimestamp(),
                    fileUrl: url,
                    filePath: filePath,
                    fileSize: file.size,
                    fileType: file.mimetype,
                    expirationTime: new Date(Date.now() + (60 * 60 * 1000))
                });

                return {
                    id: docRef.id,
                    url: url,
                    fileName: fileName,
                    originalFileName: file.originalname
                };
            } catch (error) {
                console.error(`Error uploading file ${file.originalname}:`, error);
                throw error; // Re-throw to be caught by the outer try-catch
            }
        });

        // Wait for all uploads to complete
        const uploadResults = await Promise.all(uploadPromises);

        res.status(200).json({
            success: true,
            files: uploadResults,
            message: `Successfully uploaded ${uploadResults.length} files`
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Upload failed',
            details: error.message,
            message: 'One or more files failed to upload'
        });
    }
});

route.post('/upload', upload.array('files'), async (req, res) => {
    const { cafeId } = req.query;
    const { senderName } = req.body;
    const files = req.files;

    if (!cafeId || !files || files.length === 0) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    try {
        const uploadPromises = files.map(async (file) => {
            const fileName = `${Date.now()}_${senderName}_${file.originalname}`;
            const fileRef = bucket.file(`uploads/${cafeId}/${fileName}`);
            const expirationTime = Date.now() + (30 * 60 * 1000); // 30 minutes

            // Upload with expiration metadata
            await fileRef.save(file.buffer, {
                metadata: {
                    contentType: file.mimetype,
                    metadata: {
                        senderName: senderName,
                        cafeId: cafeId,
                        originalFileName: file.originalname,
                        uploadDate: new Date().toISOString(),
                        expirationTime: expirationTime.toString()
                    }
                }
            });

            const [downloadUrl] = await fileRef.getSignedUrl({
                action: 'read',
                expires: '03-01-2500'
            });

            // Store in Firestore with expiration
            const docRef = await admin.firestore().collection('uploads').add({
                fileName,
                originalFileName: file.originalname,
                senderName,
                cafeId,
                uploadDate: serverTimestamp(),
                fileUrl: downloadUrl,
                filePath: `uploads/${cafeId}/${fileName}`,
                fileSize: file.size,
                fileType: file.mimetype,
                expirationTime: new Date(expirationTime)
            });

            return { fileName, downloadUrl, docRef };
        });

        const results = await Promise.all(uploadPromises);
        res.json({ success: true, files: results });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});



// Get uploads for a specific cafe
route.get('/api/uploads/:cafeId', async (req, res) => {
  try {
    const cafeId = req.params.cafeId;
    const uploadsSnapshot = await db.collection('uploads')
      .where('cafeId', '==', cafeId)
      .orderBy('uploadDate', 'desc')
      .get();

    const uploads = [];
    uploadsSnapshot.forEach(doc => {
      uploads.push({ id: doc.id, ...doc.data() });
    });

    res.json(uploads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch uploads', details: error.message });
  }
});

// Delete an upload
route.delete('/api/uploads/:uploadId', async (req, res) => {
  try {
    const uploadId = req.params.uploadId;
    const uploadDoc = await db.collection('uploads').doc(uploadId).get();
    
    if (!uploadDoc.exists) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const uploadData = uploadDoc.data();
    
    // Delete from Storage
    await bucket.file(uploadData.filePath).delete();
    
    // Delete from Firestore
    await db.collection('uploads').doc(uploadId).delete();

    res.json({ success: true, message: 'Upload deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete upload', details: error.message });
  }
});




module.exports = route;
