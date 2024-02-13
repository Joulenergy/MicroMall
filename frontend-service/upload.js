"use strict";

// for storing image into mongodb
const multer = require("multer");

const upload = multer({
    limits: { fieldSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/jpeg") {
            file.contentType = "image/jpeg";
            cb(null, true);
        } else if (file.mimetype === "image/png") {
            file.contentType = "image/png";
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    },
});

module.exports = upload;
