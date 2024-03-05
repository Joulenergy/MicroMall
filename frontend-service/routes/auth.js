"use strict";

const express = require("express");
const { sendItem, getResponse } = require("../useRabbit");
const rabbitmq = require("../rabbitmq");
const router = express.Router();

router
    .route("/login")
    .get((req, res) => {
        if (req.session.userId) {
            res.render("logout");
        } else {
            // Display login form
            res.render("login");
        }
    })
    .post(async (req, res) => {
        const { email, password } = req.body;

        // Send email and password to auth service
        sendItem(req, "login", { email, password });

        // Get response from auth service
        try {
            const { name, fail, id, type } = await getResponse(req.sessionID, req.session.corrId);
            if (fail) {
                res.render("login", { fail: "Invalid Email or Password" });
            } else {
                // saves user details for session
                req.session.name = name;
                req.session.email = email;
                req.session.userId = id; 
                req.session.type = type;
                res.redirect("/");
            }
        } catch (err) {
            console.error(`Error logging in -> ${err}`);
        }
    });

router.post("/logout", async (req, res) => {
    try {
        // delete response queue
        await rabbitmq.responseChannel.deleteQueue(req.sessionID);

    } catch (err) {
        console.error(`Unable to delete session queue -> ${err}`);
    }
    // destroy session data
    req.session.destroy((err) => {
        if (err) {
            console.error(`Unable to Destroy Session -> ${err}`);
        }
    });

    res.redirect("/login");
});

router
    .route("/register")
    .get((req, res) => {
        res.render("register");
    })
    .post(async (req, res) => {
        const { email, password, name } = req.body;

        // Send to queue create account
        sendItem(req, "create-account", { email, password, name });

        // Get response from auth service
        try {
            const { fail } = await getResponse(req.sessionID, req.session.corrId);
            if (fail) {
                res.render("register", { fail: "Failed to create account" });
            } else {
                res.render("register", { msg: "Account created" });
            }
        } catch (err) {
            console.error(`Error registering for account -> ${err}`);
        }
    });

module.exports = router;
