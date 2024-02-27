const express = require("express");
const upload = require("../upload");
const { sendItem, getResponse } = require("../useRabbit");
const router = express.Router();
const multer = require("multer");

function uploadFile(req, res, next) {
    const uploadFile = upload.single("image");

    uploadFile(req, res, (err) => {
        console.error(err);
        if (!err) {
            next();
        } else {
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
        }
    });
}

router
    .route("/createproduct")
    .get((req, res) => {
        // TODO: admin users authentication?
        res.render("createproduct");
    })
    .post(uploadFile, async (req, res) => {
        try {
            let { name, qty, price } = req.body;
            name = name.replace(/\w*/g, function (txt) {
                return (
                    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
                );
            });
            price = parseFloat(price).toFixed(2);
            const newProduct = {
                name,
                quantity: qty,
                image: {
                    data: req.file.buffer,
                    contentType: req.file.mimetype,
                },
                price,
            };

            // Send to queue create product
            sendItem(req, "create-product", newProduct);

            // Get response from product-service
            const { fail } = await getResponse(req.sessionID);
            console.log({ fail });
            if (fail) {
                res.render("createproduct", {
                    fail: "Failed to create product",
                });
            } else {
                res.render("createproduct", { msg: "New product created" });
            }
        } catch (err) {
            console.error(`Error creating product -> ${err}`);
        }
    });

module.exports = router;
