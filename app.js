const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

dotenv.config();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'src')));


const admin_tasks = require('./routes/admin');
const static_files = require('./routes/static_files');
const auth = require('./routes/auth');
const qrcode_gen = require('./routes/qrcode_gen');
const contact = require('./routes/contact');
const dashboard = require('./routes/dashboard');
const payment = require('./routes/payment');
const documents = require('./routes/document');
const verification = require('./routes/verification');
const upload = require('./routes/upload');
const reset = require('./routes/password_reset');

app.use('/', static_files);
app.use('/auth', auth);
app.use('/qrcode', qrcode_gen);
app.use('/contact', contact);
app.use('/dashboard', dashboard);
app.use('/payment', payment);
app.use('/files', documents);
app.use('/verification', verification);
app.use('/upload', upload);
app.use('/admin_task', admin_tasks);
app.use('/pass_reset', reset);

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
