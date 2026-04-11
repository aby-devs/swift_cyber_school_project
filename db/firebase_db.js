const admin = require('firebase-admin');


if (!admin.apps.length) {
    // Initialize Firebase Admin SDK
    const serviceAccount = require('../firebase-service.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL,
        storageBucket: process.env.STORAGE_BUCKET,
    });
}


module.exports = {
    admin,
    storage: admin.storage(),
    bucket: admin.storage().bucket()
}
