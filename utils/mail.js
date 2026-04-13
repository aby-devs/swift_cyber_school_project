const nodemailer = require('nodemailer');


const emailUser = process.env.EMAIL_USER;
const emailFromName = process.env.EMAIL_FROM_NAME;
const emailPort = Number(process.env.EMAIL_PORT);

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS,
    }
});

transporter.defaultFrom = emailFromName
    ? `"${emailFromName}" <${emailUser}>`
    : emailUser;
transporter.supportEmail = emailUser;

module.exports = transporter;
