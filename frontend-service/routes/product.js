const express = require("express");
const upload = require("../upload");
const { sendItem, getResponse } = require("../useRabbit");
const router = express.Router();

router
    .route("/createproduct")
    .get((req, res) => {
        // TODO: admin users authentication?
        res.render("createproduct");
    })
    .post(upload.single("image"), async (req, res) => {
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
                    contentType: req.file.contentType,
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
