const express = require("express");
const uploadFile = require("../upload");
const { sendItem, getResponse } = require("../useRabbit");
const router = express.Router();

router
    .route("/createproduct")
    .get((req, res) => {
        res.render("createproduct");
    })
    .post(uploadFile, async (req, res) => {
        try {
            let { name, qty, price } = req.body;

            // Check that name does not have any numbers
            if (/\d/.test(name)) {
                res.render("createproduct", {
                    fail: "Name should only contain letters!",
                });
            } else {
                name = name.replace(/\w*/g, function (txt) {
                    // changes name to title case
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
                const { fail } = await getResponse(req.sessionID, req.session.corrId);
                console.log({ fail });
                if (fail) {
                    res.render("createproduct", {
                        fail: "Failed to create product",
                    });
                } else {
                    res.render("createproduct", { msg: "New product created" });
                }
            }
        } catch (err) {
            console.error(`Error creating product -> ${err}`);
            res.render("createproduct", {
                fail: "Failed to create product",
            });
        }
    });

module.exports = router;
