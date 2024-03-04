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

function uploadFile(req, res, next) {
    const uploader = upload.single("image");

    uploader(req, res, (err) => {
        if (!err) {
            next();
        } else {
            console.error(err);
            if (err instanceof multer.MulterError) {
                // A Multer error occurred when uploading- file size limit
                return res.render("createproduct", {
                    fail: "File too large - 200 KB is limit",
                });
            }
            if (err.message === "Invalid file type") {
                // An unknown error occurred when uploading.
                return res.render("createproduct", {
                    fail: "Upload only jpeg or png!",
                });
            }
            return res.render("createproduct", {
                fail: "An unknown error has occured",
            });
        }
    });
}

module.exports = uploadFile;
