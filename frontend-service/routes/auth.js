"use strict";

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
    .post(async (req, res) => {
        const { email, password } = req.body;

        // Send email and password to auth service
        sendItem(req, "login", { email, password });

        // Get response from auth service
        try {
            const { fail, id } = await getResponse(req.sessionID);
            if (fail) {
                res.render("login", { fail: "Invalid Email or Password" });
            } else {
                req.session.userId = id; // saves userId for session
                res.redirect("/");
            }
        } catch (err) {
            console.error(`Error logging in -> ${err}`);
        }
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
            const { fail } = await getResponse(req.sessionID);
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
