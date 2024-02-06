const express = require("express");
const fs = require("fs");
const path = require("path");
const upload = require("../upload");
const { sendItem, getResponse } = require("../useRabbit");
const router = express.Router();

router
    .route("/createproduct")
    .get((req, res) => {
        if (req.session.userId) {
            // authenticated
            // TODO: admin users authentication?
            res.render("createproduct");
        } else {
            res.redirect("/login");
        }
    })
    .post(upload.single("image"), (req, res) => {
        const folderPath = "../productimages";
        let { name, qty, price } = req.body;
        name = name.replace(/\w*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        const newProduct = {
            name,
            quantity: qty,
            image: {
                data: fs.readFileSync(
                    path.join(__dirname + `/${folderPath}/` + req.file.filename)
                ),
                contentType: req.file.contentType,
            },
            price,
        };

        // Send to queue create product
        sendItem(req, "create-product", newProduct);

        // Clear productimages folder
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            if (files.length > 0) {
                for (const file of files) {
                    const filePath = path.join(folderPath, file);
                    fs.unlinkSync(filePath);
                }
            }
        }

        // Get response from product-service
        getResponse(req.sessionID, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log({msg});

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("createproduct", {
                    fail: "Failed to create product",
                });
            } else {
                res.render("createproduct", { msg: "New product created" });
            }
        });
    });

module.exports = router;
