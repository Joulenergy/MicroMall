const express = require("express");
const { sendItem, getResponse } = require("../useRabbit");
const router = express.Router();

router
    .route("/login")
    .get((req, res) => {
        if (req.session.userId) {
            res.send("Logout?");
            //TODO: logout, destroy session, queue etc.
        } else {
            // Display login form
            res.render("login");
        }
    })
    .post((req, res) => {
        const { email, password } = req.body;

        // Send email and password to auth service
        sendItem(req, "login", { email, password });

        // Get response from auth service
        getResponse(req.sessionID, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log({msg});

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("login", { fail: "Invalid Email or Password" });
            } else {
                req.session.userId = msg.id; // saves userId for session
                res.redirect("/");
            }
        });
    });

router
    .route("/register")
    .get((req, res) => {
        res.render("register");
    })
    .post((req, res) => {
        const { email, password, name } = req.body;

        // Send to queue create account
        sendItem(req, "create-account", { email, password, name });

        // Get response from auth service
        getResponse(req.sessionID, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log({msg});

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("register", { fail: "Failed to create account" });
            } else {
                res.render("register", { msg: "Account created" });
            }
        });
    });

module.exports = router;
