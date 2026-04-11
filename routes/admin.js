const express = require('express');
const route = express.Router();
const firebaseAdmin = require('../db/firebase_db');
const admin = firebaseAdmin.admin;


route.get('/admin/users', (req, res) => {
    console.log("work in progress");
});


route.post('/admin/upgrade-user', (req, res) => {
    console.log("work in progress");
})


route.post('/admin/downgrade-user', (req, res) => {
    console.log("work in progress");
});

module.exports = route;
