const express = require('express');
const route = express.Router();
const firebaseAdmin = require('../db/firebase_db');
const admin = firebaseAdmin.admin;


route.post('/api/check-verification', async (req, res) => {
    const { email } = req.body;
    const uniqueId = req.cookies.uniqueId;

    if (!uniqueId) {
        return res.status(400).json({ message: 'Unique ID not found.' });
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(email);

        if (userRecord.emailVerified) {
            const db = admin.database();
            const cafeRef = db.ref(`cafes/${uniqueId}`);
            await cafeRef.update({ verified: true });

            res.status(200).json({ message: 'Email verified successfully', uniqueId });
        } else {
            res.status(400).json({ message: 'Email not verified.' });
        }
    } catch (error) {
        console.error('Verification Check Error:', error);
        res.status(500).json({ message: 'Verification check failed', error: error.message });
    }
});



module.exports = route;
