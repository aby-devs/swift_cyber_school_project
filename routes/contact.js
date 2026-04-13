const express = require('express');
const route = express.Router();
const transporter = require('../utils/mail');
const firebaseAdmin = require('../db/firebase_db')
const admin = firebaseAdmin.admin;


route.get('/api/cafe/:cafeId', async (req, res) => {
    const { cafeId } = req.params;
    const sessionCookie = req.cookies.session;

    try {
        // Verify session exists and matches the requested cafeId
        if (sessionCookie) {
            const sessionData = JSON.parse(sessionCookie);
            if (sessionData.cafeId !== cafeId) {
                return res.status(403).json({ 
                    message: 'Unauthorized access' 
                });
            }
        }

        const cafeRef = admin.database().ref(`cafes/${cafeId}`);
        const snapshot = await cafeRef.once('value');
        const cafeData = snapshot.val();

        if (!cafeData) {
            return res.status(404).json({ 
                message: 'Cafe not found' 
            });
        }

        res.json({
            cyberId: cafeId,
            cafeName: cafeData.cafeName,
            email: cafeData.email
        });

    } catch (error) {
        console.error('Error fetching cafe details:', error);
        res.status(500).json({ 
            message: 'Failed to fetch cafe details', 
            error: error.message 
        });
    }
});



route.post('/api/contact', async (req, res) => {
    const { cyberId, subject, message } = req.body;

    if (!cyberId || !subject || !message) {
        return res.status(400).json({ 
            message: 'All fields are required' 
        });
    }

    try {
        // Get cafe details
        const cafeRef = admin.database().ref(`cafes/${cyberId}`);
        const cafeSnapshot = await cafeRef.once('value');
        const cafeData = cafeSnapshot.val();

        if (!cafeData) {
            return res.status(404).json({ 
                message: 'Cafe not found' 
            });
        }

        // Store contact message in database
        const contactRef = admin.database().ref('contacts');
        await contactRef.push({
            cyberId,
            subject,
            message,
            cafeEmail: cafeData.email,
            cafeName: cafeData.cafeName,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });

        // Configure email with clear sender information in the display name
        const mailOptions = {
            from: transporter.defaultFrom,
            to: transporter.supportEmail,
            replyTo: cafeData.email,
            subject: `New Contact Message from ${cafeData.cafeName} <${cafeData.email}>: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h2 style="color: #333; margin-top: 0;">Message from Cafe Customer</h2>
                        <p style="font-size: 16px; color: #666;">
                            <strong>Reply-To Address:</strong> ${cafeData.email}
                        </p>
                    </div>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Sender Information</h3>
                        <p><strong>Cafe Name:</strong> ${cafeData.cafeName}</p>
                        <p><strong>Cafe ID:</strong> ${cyberId}</p>
                        <p><strong>Email:</strong> ${cafeData.email}</p>
                    </div>

                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <h3 style="margin-top: 0;">Message</h3>
                        <p><strong>Subject:</strong> ${subject}</p>
                        <p><strong>Content:</strong></p>
                        <div style="background-color: white; padding: 15px; border-radius: 5px;">
                            ${message}
                        </div>
                    </div>

                    <p style="color: #666; font-size: 0.9em; margin-top: 20px;">
                        Sent on: ${new Date().toLocaleString()}
                    </p>
                    
                    <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <p style="color: #666; font-size: 0.9em; margin: 0;">
                            <strong>Note:</strong> This message was sent via the contact form. 
                            To reply, simply respond to this email - it will go directly to ${cafeData.email}
                        </p>
                    </div>
                </div>
            `
        };

        // Send email using the transporter
        await transporter.sendMail(mailOptions);

        // Send confirmation email to cafe
        const confirmationMailOptions = {
            from: transporter.defaultFrom,
            to: cafeData.email,
            subject: `Confirmation: We received your message - ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Message Received</h2>
                    <p>Dear ${cafeData.cafeName},</p>
                    <p>We have received your message and will get back to you soon. Here's a copy of your message:</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Subject:</strong> ${subject}</p>
                        <p><strong>Message:</strong></p>
                        <div style="background-color: white; padding: 15px; border-radius: 5px;">
                            ${message}
                        </div>
                    </div>

                    <p>We'll respond to your inquiry as soon as possible.</p>
                    <p>Best regards,<br>Your Support Team</p>
                </div>
            `
        };

        // Send confirmation email
        await transporter.sendMail(confirmationMailOptions);

        res.status(200).json({ 
            message: 'Contact message sent successfully' 
        });

    } catch (error) {
        console.error('Contact submission error:', error);
        res.status(500).json({ 
            message: 'Failed to send contact message', 
            error: error.message 
        });
    }
});


// Get cafe details for contact form
route.get('/api/cafe/:cafeId', async (req, res) => {
    const { cafeId } = req.params;
    const sessionCookie = req.cookies.session;

    try {
        // Verify session exists and matches the requested cafeId
        if (sessionCookie) {
            const sessionData = JSON.parse(sessionCookie);
            if (sessionData.cafeId !== cafeId) {
                return res.status(403).json({ 
                    message: 'Unauthorized access' 
                });
            }
        }

        const cafeRef = admin.database().ref(`cafes/${cafeId}`);
        const snapshot = await cafeRef.once('value');
        const cafeData = snapshot.val();

        if (!cafeData) {
            return res.status(404).json({ 
                message: 'Cafe not found' 
            });
        }

        res.json({
            cyberId: cafeId,
            cafeName: cafeData.cafeName,
            email: cafeData.email
        });

    } catch (error) {
        console.error('Error fetching cafe details:', error);
        res.status(500).json({ 
            message: 'Failed to fetch cafe details', 
            error: error.message 
        });
    }
});



module.exports = route;
