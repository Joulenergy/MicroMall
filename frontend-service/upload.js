"use strict";

// for storing image into mongodb
const multer = require("multer");

const upload = multer({
    limits: { fileSize: 200 * 1024 }, // Limit file to 200 KB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"), false);
        }
    },
});

module.exports = upload;
