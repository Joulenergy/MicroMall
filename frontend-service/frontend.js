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
                res.render("catalog", {
                    showcart,
                    productitems,
                    cartitems: {},
                });
            } else {
                res.render("catalog", {
                    showcart,
                    productitems,
                    cartitems: cart.items,
                });
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

app.post("/checkstocks", async (req, res) => {
    try {
        // ask cart service to send data
        sendItem(req, "get-cart", { id: req.session.userId });

        let cart = await getResponse(req.sessionID);
        console.log({ cart });

        if (JSON.stringify(cart) == "{}") {
            // if cart is empty and user press checkout or other possibilities
            res.redirect("/");
        }

        let productIds = [];
        cart.items.forEach((item) => {
            productIds.push(item._id);
        });

        // Ask product service to send data
        sendItem(req, "catalog", { all: false, productIds });

        // Get response from product service
        const productitems = await getResponse(req.sessionID);
        console.log({ productitems });

        // Check stocks
        let product;
        cart.items.forEach(async (item) => {
            const correspondingProduct = productitems.find(
                (product) => product._id == item._id
            );
            console.log({ correspondingProduct });

            if (correspondingProduct) {
                if (correspondingProduct.quantity < item.quantity) {
                    // qty will be a negative number
                    const qty = parseInt(
                        correspondingProduct.quantity - item.quantity
                    );
                    console.log({ cart });
                    item.quantity = correspondingProduct.quantity;
                    console.log({ cart });

                    // changes cart in case user undo checkout and for payment
                    sendItem(req, "change-cart", {
                        id: req.session.userId,
                        name: item.name,
                        qty,
                        maxqty: product.quantity,
                    });
                    await getResponse(req.sessionID);
                }
            } else {
                // no stock in product, might have been deleted
                console.log({ cart });
                cart.items.slice(cart.items.indexOf(item), 1);
                console.log({ cart });

                // changes cart in case user undo checkout and for payment
                sendItem(req, "change-cart", {
                    id: req.session.userId,
                    name: item.name,
                    qty: -item.quantity,
                    maxqty: product.quantity,
                });
                await getResponse(req.sessionID);
            }
        });
        console.log({ cart });

        res.render("confirm", {
            sessionid: req.sessionID,
            name: req.session.name,
            email: req.session.email,
            userId: req.session.userId,
            productitems,
            cartitems: cart.items,
        });
    } catch (err) {
        console.error(`Error checking stocks -> ${err}`);
    }
});

app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);
