const express = require('express');
const route = express.Router();
const IntaSend = require('intasend-node');
const firebaseAdmin = require('../db/firebase_db')
const admin = firebaseAdmin.admin;


const intasend = new IntaSend(
    process.env.PUB_KEY,
    process.env.SEC_KEY,
    false
);


route.get('/trial-status/:cafeId', async (req, res) => {
    const { cafeId } = req.params;

    if (!cafeId) {
        return res.status(400).json({ error: 'No Cafe ID provided' });
    }

    try {
        const db = admin.database();
        const cafeRef = db.ref(`cafes/${cafeId}`);

        // First check and update premium expiration
        await checkPremiumExpiration(cafeId);

        const snapshot = await cafeRef.once('value');

        if (snapshot.exists()) {
            const cafeData = snapshot.val();

            // Handle different subscription states
            if (cafeData.subscriptionStatus === 'premium') {
                const premiumEndDate = new Date(cafeData.premiumEndDate);
                const currentDate = new Date();
                const hoursRemaining = Math.ceil((premiumEndDate - currentDate) / (1000 * 60 * 60));

                return res.json({
                    isExpired: false,
                    isPremium: true,
                    subscriptionStatus: 'premium',
                    hoursRemaining: hoursRemaining,
                    premiumEndDate: premiumEndDate.toISOString()
                });
            } else if (cafeData.subscriptionStatus === 'expired') {
                return res.json({
                    isExpired: true,
                    isPremium: false,
                    subscriptionStatus: 'expired'
                });
            }

            // Handle trial status (existing trial logic)
            const trialStartDate = new Date(cafeData.trialStartDate);
            const trialEndDate = new Date(cafeData.trialEndDate);
            const currentDate = new Date();

            const hoursRemaining = Math.ceil((trialEndDate - currentDate) / (1000 * 60 * 60));
            const totalTrialDuration = (trialEndDate - trialStartDate) / (1000 * 60 * 60);
            const elapsedTime = (currentDate - trialStartDate) / (1000 * 60 * 60);
            const progressPercentage = Math.min(100, (elapsedTime / totalTrialDuration) * 100);

            res.json({
                isExpired: currentDate > trialEndDate,
                isPremium: false,
                subscriptionStatus: 'trial',
                hoursRemaining: hoursRemaining <= 0 ? 0 : hoursRemaining,
                progressPercentage: progressPercentage,
                trialStartDate: trialStartDate.toISOString(),
                trialEndDate: trialEndDate.toISOString()
            });
        } else {
            res.status(404).json({ error: 'Cafe not found' });
        }
    } catch (error) {
        console.error('Error checking subscription status:', error);
        res.status(500).json({ error: error.message });
    }
});



// Add these routes to your existing route.js
route.post('/api/process-payment', async (req, res) => {
    const uniqueId = req.cookies.uniqueId;
    console.log('Received payment request:', req.body);

    if (!uniqueId) {
        console.error('No uniqueId found in cookies');
        return res.status(400).json({ error: 'Session expired. Please refresh the page.' });
    }

    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber || !/^254[0-9]{9}$/.test(phoneNumber)) {
            console.log('Invalid phone number:', phoneNumber);
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        const collection = intasend.collection();
        const response = await collection.mpesaStkPush({
            first_name: 'Customer',
            last_name: 'User',
            email: 'customer@example.com',
            host: 'https://yourwebsite.com',
            amount: 1,
            phone_number: phoneNumber,
            api_ref: `payment_${Date.now()}`,
            settlement: {
                provider: 'mpesa',
                provider_type: 'till',
                till_number: '3022704',
                phone_number: '254701652148'
            }
        });

        if (!response.invoice || !response.invoice.invoice_id) {
            console.log('Payment initiation failed:', response);
            return res.status(400).json({ error: 'Payment failed. Please try again.' });
        }

        // Store the payment request details in Firebase
        const paymentDetails = {
            status: 'pending',
            uniqueId,
            phoneNumber,
            invoice_id: response.invoice.invoice_id,
            timestamp: admin.database.ServerValue.TIMESTAMP
        };

        await admin.database()
        .ref(`paymentStatus/${response.invoice.invoice_id}`)
        .set(paymentDetails);

        console.log('Payment data saved:', paymentDetails);
        console.log(`Stored invoiceId: ${response.invoice.invoice_id}`);
        console.log('Payment initiated successfully:', response.invoice.invoice_id);

        res.json({ 
            success: true, 
            invoiceId: response.invoice.invoice_id,
            message: 'Please check your phone to complete the payment'
        });

    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
});

// webhook
// Add this function to handle subscription updates
async function updateSubscriptionStatus(uniqueId) {
    try {
        const cafeRef = admin.database().ref(`cafes/${uniqueId}`);
        const snapshot = await cafeRef.once('value');

        if (!snapshot.exists()) {
            console.error('Cafe not found:', uniqueId);
            return false;
        }

        // Calculate premium end date (30 days from now)
        const premiumEndDate = new Date();
        premiumEndDate.setDate(premiumEndDate.getDate() + 30);


        // Update subscription status to premium with end date
        await cafeRef.update({
            subscriptionStatus: 'premium',
            upgradedAt: admin.database.ServerValue.TIMESTAMP,
            premiumEndDate: premiumEndDate.toISOString(),
            // Remove trial-related fields
            trialEndDate: null,
            trialStartDate: null
        });

        return true;
    } catch (error) {
        console.error('Error updating subscription status:', error);
        return false;
    }
}

async function checkPremiumExpiration(cafeId) {
    try {
        const cafeRef = admin.database().ref(`cafes/${cafeId}`);
        const snapshot = await cafeRef.once('value');

        if (!snapshot.exists()) return;

        const cafeData = snapshot.val();
        if (cafeData.subscriptionStatus !== 'premium') return;

        const premiumEndDate = new Date(cafeData.premiumEndDate);
        const currentDate = new Date();

        if (currentDate > premiumEndDate) {
            // Update status to expired
            await cafeRef.update({
                subscriptionStatus: 'expired',
                expiredAt: admin.database.ServerValue.TIMESTAMP
            });
        }
    } catch (error) {
        console.error('Error checking premium expiration:', error);
    }
}


// Modify the existing webhook endpoint to handle subscription updates
route.post('/webhook/payment', async (req, res) => {
    try {
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        console.log('Received webhook payload:', payload);

        const invoiceData = payload.invoice || payload;
        const invoiceId = invoiceData.invoice_id || invoiceData.id;
        const state = invoiceData.state;

        if (!invoiceId) {
            console.error('No invoice_id found in payload:', payload);
            return res.sendStatus(400);
        }

        console.log(`Processing payment webhook for invoice: ${invoiceId}, state: ${state}`);

        if (state === 'COMPLETE') {
            console.log('Fetching payment status for invoice:', invoiceId);
            const paymentStatusSnapshot = await admin.database()
                .ref(`paymentStatus/${invoiceId}`)
                .get();

            const storedPayment = paymentStatusSnapshot.val();
            if (!storedPayment || !storedPayment.uniqueId) {
                console.error('Payment details not found for invoice:', invoiceId);
                return res.sendStatus(400);
            }
            console.log('Retrieved stored payment:', storedPayment);

            try {
                // Update subscription status
                const subscriptionUpdated = await updateSubscriptionStatus(storedPayment.uniqueId);
                if (!subscriptionUpdated) {
                    console.error('Failed to update subscription status for:', storedPayment.uniqueId);
                    return res.sendStatus(500);
                }

                // Fetch cafe details to get email
                const cafeSnapshot = await admin.database()
                    .ref(`cafes/${storedPayment.uniqueId}`)
                    .get();

                const cafeData = cafeSnapshot.val();
                if (!cafeData || !cafeData.email) {
                    console.error('Cafe details not found for ID:', storedPayment.uniqueId);
                    return res.sendStatus(400);
                }

                // Store payment data
                const paymentData = {
                    status: 'completed',
                    uniqueId: storedPayment.uniqueId,
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                    state: state,
                    mpesa_reference: invoiceData.mpesa_reference,
                    amount: invoiceData.value,
                    phone_number: storedPayment.phoneNumber
                };

                console.log('Storing payment data:', paymentData);
                await admin.database().ref(`payments/${invoiceId}`).set(paymentData);

                // Send confirmation email with premium status
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: cafeData.email,
                    subject: 'Premium Upgrade Confirmation - Swift Cyber',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #333; text-align: center;">Premium Upgrade Confirmation</h2>

                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Dear ${cafeData.cafeName},</strong></p>
                        <p style="margin: 10px 0;">Your payment has been successfully processed and your account has been upgraded to Premium status!</p>

                        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;"> 
                        <h3 style="color: #333; margin-top: 0;">Payment Details:</h3> 
                        <p><strong>Amount:</strong> KES ${invoiceData.value}</p> 
                        <p><strong>M-Pesa Reference:</strong> ${invoiceData.mpesa_reference}</p> 
                        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p> 
                        <p><strong>Status:</strong> Completed</p> </div>

                        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0;"> <h3 style="color: #2e7d32; margin-top: 0;">Premium Benefits Activated:</h3>
                        <ul style="color: #1b5e20;">
                        <li>Unlimited document access</li>
                        <li>Priority support</li>
                        <li>Advanced analytics</li>
                        <li>Custom branding</li>
                        </ul>
                        </div>
                        <p style="margin: 15px 0;">Your premium features are now active. Thank you for choosing Swift Cyber!</p>
                        </div>

                        <div style="text-align: center; color: #666; font-size: 0.9em; margin-top: 20px;">
                        <p>If you have any questions about your premium subscription, please don't hesitate to contact us.</p>
                        <p>Swift Cyber Team</p>
                        </div>
                        </div>
`
                };

                await transporter.sendMail(mailOptions);
                console.log('Premium upgrade confirmation email sent to:', cafeData.email);

                // Clean up pending payment status
                await admin.database().ref(`paymentStatus/${invoiceId}`).remove();
                console.log('Cleaned up pending payment status for invoice:', invoiceId);

            } catch (error) {
                console.error('Error processing completed payment:', error);
                return res.sendStatus(500);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.sendStatus(500);
    }
});

// check payment
route.get('/api/check-payment/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        console.log('Checking payment status for invoice:', invoiceId);

        // Check completed payments first
        const completedPaymentSnapshot = await admin.database()
            .ref(`payments/${invoiceId}`)
            .get();

        const completedPayment = completedPaymentSnapshot.val();
        console.log('Completed payment data:', completedPayment);

        if (completedPayment && completedPayment.status === 'completed') {
            return res.json({ status: 'complete' });
        }

        // Check IntaSend status
        const collection = intasend.collection();
        const intasendStatus = await collection.status(invoiceId);
        console.log('IntaSend status:', intasendStatus);

        if (intasendStatus?.invoice?.state === 'COMPLETE') {
            try {
                // Get payment details from stored data
                const paymentStatusSnapshot = await admin.database()
                    .ref(`paymentStatus/${invoiceId}`)
                    .get();

                const storedPayment = paymentStatusSnapshot.val();
                if (!storedPayment || !storedPayment.uniqueId) {
                    console.error('Payment details not found for invoice:', invoiceId);
                    return res.json({ status: 'error', message: 'Payment details not found' });
                }

                // Store payment completion data
                await admin.database().ref(`payments/${invoiceId}`).set({
                    status: 'completed',
                    uniqueId: storedPayment.uniqueId,
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                    state: intasendStatus.invoice.state,
                    mpesa_reference: intasendStatus.invoice.mpesa_reference,
                    amount: intasendStatus.invoice.value,
                    phone_number: storedPayment.phoneNumber
                });

                // Clean up the pending payment status
                await admin.database().ref(`paymentStatus/${invoiceId}`).remove();

                return res.json({ status: 'complete' });
            } catch (error) {
                console.error('Error processing completed payment:', error);
                return res.json({ status: 'pending', message: 'Payment completed, finalizing...' });
            }
        }

        // Check pending status
        const pendingPaymentSnapshot = await admin.database()
            .ref(`paymentStatus/${invoiceId}`)
            .get();

        const pendingPayment = pendingPaymentSnapshot.val();
        console.log('Pending payment data:', pendingPayment);

        // Return routeropriate status
        const status = intasendStatus?.invoice?.state?.toLowerCase() || 
            (pendingPayment ? 'pending' : 'not_found');

        res.json({ status });

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});




module.exports = route;

