"use strict";

// for storing image into mongodb
const fs = require('fs')
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folderPath = 'productimages';
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
        }
        cb(null, folderPath)
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fieldSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') {
    file.contentType = 'image/jpeg';
    cb(null, true);
    } else if (file.mimetype === 'image/png') {
    file.contentType = 'image/png';
    cb(null, true);
    } else {
    cb(new Error('Invalid file type'));
    }
}
});

module.exports = upload
