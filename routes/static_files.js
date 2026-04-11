const express = require('express');
const route = express.Router();
const path = require('path');



route.get('/', (req, res) => res.sendFile(path.join(__dirname, '../src/html/welcome.html')));
route.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../src/html/login.html')));
route.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '../src/html/signup.html')));
route.get('/verification', (req, res) => res.sendFile(path.join(__dirname, '../src/html/verification.html')));
route.get('/qrcode', (req, res) => res.sendFile(path.join(__dirname, '../src/html/qrcode.html')));
route.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../src/html/dashboard.html')));
route.get('/upload', (req, res) => res.sendFile(path.join(__dirname, '../src/html/upload.html')));
route.get('/forgot', (req, res) => res.sendFile(path.join(__dirname, '../src/html/forgot.html')));
route.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '../src/html/contact.html')));
route.get('/terms', (req, res) => res.sendFile(path.join(__dirname, '../src/html/terms.html')));
route.get('/mpesa_stk', (req, res) => res.sendFile(path.join(__dirname, '../src/html/mpesa_stk.html')));
route.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../src/html/admin.html')));
route.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '../src/html/privacy.html')));




module.exports = route;
