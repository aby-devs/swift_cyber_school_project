const express = require('express');
const route = express.Router();
const { v4: uuidv4 } = require('uuid');
const { generateQRCode } = require('../utils/qrcode');
const firebaseAdmin = require('../db/firebase_db')
const admin = firebaseAdmin.admin;
const transporter = require('../utils/mail');



// generate uniqueId
function generateUniqueId(county) {
    return `${county}-${uuidv4().split('-')[0].toUpperCase()}`;
}

function withTimeout(promise, timeoutMs, stepName) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${stepName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}


// Signup endpoint
route.post('/api/signup', async (req, res) => {
    const { email, password, location, cafeName } = req.body;
    let createdUserUid = null;
    let createdCafeId = null;

    try {
        const userRecord = await withTimeout(
            admin.auth().createUser({ email, password }),
            15000,
            'Creating user'
        );
        createdUserUid = userRecord.uid;
        const uniqueId = generateUniqueId(location);
        createdCafeId = uniqueId;
        const qrCodeUrl = await withTimeout(
            generateQRCode(uniqueId),
            15000,
            'Generating QR code'
        );

        // Generate and send verification email
        const verificationLink = await withTimeout(
            admin.auth().generateEmailVerificationLink(email),
            10000,
            'Generating verification link'
        );
        const mailOptions = {
            from: transporter.defaultFrom,
            to: email,
            subject: 'Verify Your Email',
            html: `
                <p>Thank you for signing up!</p>
                <p>Please verify your email:</p>
                <a href="${verificationLink}">Verify email</a>
                <p>Swift Cyber Team</p>
            `,
        };

        // Set trial dates (5 hours from now)
        const trialStartDate = new Date();
        //const trialEndDate = new Date(trialStartDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 days
        const trialEndDate = new Date(trialStartDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days

        // Save cafe data
        const db = admin.database();
        const cafeRef = db.ref(`cafes/${uniqueId}`);
        await withTimeout(cafeRef.set({
            cafeName,
            location,
            email,
            verified: false,
            qrCodeUrl,
            trialStartDate: trialStartDate.toISOString(),
            trialEndDate: trialEndDate.toISOString(),
            subscriptionStatus: 'trial' // Add subscription status
        }), 10000, 'Saving cafe data');

        // Send verification email, but don't block signup if SMTP provider times out.
        try {
            await withTimeout(
                transporter.sendMail(mailOptions),
                12000,
                'Sending verification email'
            );
        } catch (mailError) {
            console.error('Signup email send failed:', mailError);
        }

        res.cookie('uniqueId', uniqueId, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        });

        res.redirect(`/verification?email=${encodeURIComponent(email)}&uniqueId=${uniqueId}`);
    } catch (error) {
        console.error('Signup Error:', error);

        // Best-effort cleanup to avoid partially-created accounts blocking retry.
        if (createdCafeId) {
            try {
                await admin.database().ref(`cafes/${createdCafeId}`).remove();
            } catch (cleanupError) {
                console.error('Signup cleanup cafe error:', cleanupError);
            }
        }
        if (createdUserUid) {
            try {
                await admin.auth().deleteUser(createdUserUid);
            } catch (cleanupError) {
                console.error('Signup cleanup user error:', cleanupError);
            }
        }

        res.status(500).json({ message: 'Signup failed', error: error.message });
    }
});


route.post('/api/login', async (req, res) => {
    const { email, password, rememberMe } = req.body;

    // Input validation
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    try {
        // Initialize Firebase Auth
        const auth = admin.auth();
        const db = admin.database();

        // First, verify if the user exists in Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
            throw error;
        }

        // Check if email is verified
        if (!userRecord.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Please verify your email before logging in'
            });
        }

        // Query the database for cafe information
        const cafesRef = db.ref('cafes');
        const snapshot = await cafesRef.once('value');
        let userCafeId = null;
        let cafeData = null;

        snapshot.forEach((childSnapshot) => {
            const cafe = childSnapshot.val();
            if (cafe.email && cafe.email.toLowerCase() === email.toLowerCase()) {
                userCafeId = childSnapshot.key;
                cafeData = cafe;
                return true; // Break the forEach loop
            }
        });

        if (!userCafeId || !cafeData) {
            return res.status(404).json({
                success: false,
                message: 'No cafe found for this email'
            });
        }

        // Verify password using Firebase Auth REST API
        try {
            const response = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'routelication/json'
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        returnSecureToken: true
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                // Password verification failed
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
            });
            }

            // Password verified successfully
            // Create custom token for frontend authentication
            const customToken = await auth.createCustomToken(userRecord.uid);

            // Clear any existing cookies
            res.clearCookie('session');
            res.clearCookie('uniqueId');
            res.clearCookie('rememberedEmail');

            // Set remember me cookie if requested
            if (rememberMe) {
                res.cookie('rememberedEmail', email, {
                    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict'
                });
            }

            // Set session cookie
            const sessionData = {
                token: customToken,
                cafeId: userCafeId,
                email: email
            };

            res.cookie('session', JSON.stringify(sessionData), {
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.cookie('uniqueId', userCafeId, {
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            // Send success response
            return res.status(200).json({
                success: true,
                message: 'Login successful',
                cafeId: userCafeId,
                cafeName: cafeData.cafeName,
                token: customToken
            });

        } catch (error) {
            console.error('Firebase Auth Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authentication failed',
                error: error.message
            });
        }

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});





route.post('/logout', (req, res) => {
    // Clear cookies
    res.clearCookie('session');
    res.clearCookie('uniqueId');
    res.clearCookie('rememberedEmail');
    
    // Set cache-control headers
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    res.status(200).json({ message: 'Logged out successfully' });
});



module.exports = route;
