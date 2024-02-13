"use strict";

const express = require("express");
const session = require("express-session");
const ejs = require("ejs");
const { sendItem, getResponse } = require("./useRabbit");
const app = express();

// Configure middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public/"));

// Create session
app.use(
    session({
        secret: `${process.env.secret}`,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true }, // secure: true is not set since run on localhost
    })
);
// TODO: add mongodb session store and add csurf?

app.get("/", async (req, res) => {
    // product catalog page
    if (req.session.userId) {
        // authenticated
        try {
            const showcart = req.session.showcart === true;

            // Ask product service to send data
            sendItem(req, "catalog", { all: true });
            // possible TODO: display different categories of items based on page
            // but ejs for cart will need to change

            // Get response from product service
            const productitems = await getResponse(req.sessionID);
            console.log({ productitems });

            // ask cart service to send data
            sendItem(req, "get-cart", { id: req.session.userId });

            const cart = await getResponse(req.sessionID);
            console.log({ cart });

            if (JSON.stringify(cart) == "{}") {
                res.render("catalog", { showcart, productitems, cartitems: {} });
            } else {
                res.render("catalog", { showcart, productitems, cartitems: cart.items });
            }
        } catch (err) {
            console.log(`Error loading catalog page -> ${err}`);
        }
    } else {
        res.redirect("/login");
    }
});

// Product Service router
const productRouter = require("./routes/product");
app.use("/", productRouter);

// Auth Service router
const authRouter = require("./routes/auth");
app.use("/", authRouter);

// Cart Service router
const cartRouter = require("./routes/cart");
app.use("/", cartRouter);

app.post("/checkstocks", (req, res) => {
    res.send("Checking Stocks for Your Order...");
});

app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);
