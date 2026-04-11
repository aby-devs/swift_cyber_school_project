const express = require('express');
const route = express.Router();
const firebaseAdmin = require('../db/firebase_db');
const admin = firebaseAdmin.admin;
const transporter = require('../utils/mail');

// Password reset request endpoint
route.post('/reset-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Verify the user exists
        const userRecord = await admin.auth().getUserByEmail(email);
        
        // Generate password reset link
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        
        // Send reset email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reset Your Password',
            html: `
                <p>Hello,</p>
                <p>You requested to reset your password. Click the link below to reset it:</p>
                <a href="${resetLink}">Reset password</a>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>Swift Cyber Team</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            message: 'Password reset link sent successfully' 
        });

    } catch (error) {
        console.error('Password Reset Error:', error);
        
        // Handle specific Firebase Auth errors
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ 
                message: 'No user found with this email address.' 
            });
        }
        
        res.status(500).json({ 
            message: 'Failed to send password reset link', 
            error: error.message 
        });
    }
});

// Verify reset token endpoint (optional, for custom reset page)
route.get('/verify-reset-token', async (req, res) => {
    const { oobCode } = req.query; // oobCode is the reset token from the email link

    try {
        // Verify the action code (reset token)
        await admin.auth().verifyPasswordResetCode(oobCode);
        res.status(200).json({ 
            message: 'Valid reset token' 
        });
    } catch (error) {
        console.error('Token Verification Error:', error);
        res.status(400).json({ 
            message: 'Invalid or expired reset token', 
            error: error.message 
        });
    }
});

// Complete password reset endpoint (optional, for custom reset page)
route.post('/complete-reset', async (req, res) => {
    const { oobCode, newPassword } = req.body;

    try {
        // Confirm the password reset
        await admin.auth().confirmPasswordReset(oobCode, newPassword);
        res.status(200).json({ 
            message: 'Password reset successful' 
        });
    } catch (error) {
        console.error('Password Reset Completion Error:', error);
        res.status(400).json({ 
            message: 'Failed to reset password', 
            error: error.message 
        });
    }
});



module.exports = route;
