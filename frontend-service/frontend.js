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

// Ensure user does not access pages without logging in
app.use((req, res, next) => {
    if (!req.session.userId && !["/login", "/register"].includes(req.path)) {
        res.redirect("/login");
    } else {
        next();
    }
});

/**
 * Check stocks in cart
 * @param {express.Request} req
 * @param {Object[]} productitems
 * @param {Object} cart
 * @returns {Array}
 */
async function checkstocks(req, productitems, cart) {
    let alertmsg = "";
    let removeItems = [];

    // Check stocks
    for (const item of cart.items) {
        let correspondingProduct = productitems.find(
            (product) => product._id == item._id
        );
        console.log({ correspondingProduct });

        if (correspondingProduct) {
            if (correspondingProduct.quantity < item.quantity) {
                // qty will be a negative number
                const qty = parseInt(
                    correspondingProduct.quantity - item.quantity
                );
                console.log({ cartitems: cart.items });
                item.quantity = correspondingProduct.quantity;
                console.log({ cartitems: cart.items });

                // update alert msg
                if (!alertmsg) {
                    alertmsg = `The following items have been updated in your cart due to stock changes: ${item.name}`;
                } else {
                    alertmsg += `, ${item.name}`;
                }

                // update cart
                sendItem(req, "change-cart", {
                    id: req.session.userId,
                    name: item.name,
                    qty,
                    maxqty: correspondingProduct.quantity,
                })
                await getResponse(req.sessionID);
            }
        } else {
            // no stock in product, might have been deleted
            removeItems.push(item);

            // update alert msg
            if (!alertmsg) {
                alertmsg = `The following items have been updated in your cart due to stock changes: ${item.name}`;
            } else {
                alertmsg += `, ${item.name}`;
            }

            // update cart
            sendItem(req, "change-cart", {
                id: req.session.userId,
                name: item.name,
                qty: -item.quantity,
                maxqty: 0,
            })
            
            await getResponse(req.sessionID);
        }
    }

    for (const item in removeItems) {
        console.log({ cartitems: cart.items });
        console.log("Removing product from cart...");
        cart.items.splice(cart.items.indexOf(item), 1);
        console.log({ cartitems: cart.items });
        if (cart.items.length === 0) {
            cart.items = {};
        }
    }

    return [cart, alertmsg];
}

app.get("/", async (req, res) => {
    // product catalog page
    try {
        const showcart = req.session.showcart === true;

        // Ask product service to send data
        sendItem(req, "catalog", { all: true });

        // Get response from product service
        const productitems = await getResponse(req.sessionID);
        console.log({ productitems });

        // ask cart service to send data
        sendItem(req, "get-cart", { id: req.session.userId });

        let cart = await getResponse(req.sessionID);
        console.log({ cart });

        if (JSON.stringify(cart) == "{}") {
            res.render("catalog", {
                showcart,
                productitems,
                cartitems: {},
                alertmsg: "",
            });
        } else {
            let alertmsg;
            [cart, alertmsg] = await checkstocks(req, productitems, cart);
            console.log({ cartbeforerender: cart });
            console.log({ alertmsgbeforerender: alertmsg });

            res.render("catalog", {
                showcart,
                productitems,
                cartitems: cart.items,
                alertmsg,
            });
        }
    } catch (err) {
        console.log(`Error loading catalog page -> ${err}`);
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
        console.log({ cartitems: cart.items });

        if (JSON.stringify(cart) == "{}") {
            // in case user somehow enters this page with empty cart
            res.redirect("/");
        }

        // Get product ids to ask product service for stocks
        let productIds = [];
        cart.items.forEach((item) => {
            productIds.push(item._id);
        });

        // Ask product service to send data
        sendItem(req, "catalog", { all: false, productIds });

        // Get response from product service
        const productitems = await getResponse(req.sessionID);
        console.log({ productitems });

        let alertmsg;
        [cart, alertmsg] = await checkstocks(req, productitems, cart);
        console.log({ cartitems: cart.items });
        console.log({ alertmsg });

        res.render("confirm", {
            sessionid: req.sessionID,
            name: req.session.name,
            email: req.session.email,
            userId: req.session.userId,
            productitems,
            cartitems: cart.items,
            alertmsg,
        });
    } catch (err) {
        console.error(`Error checking stocks -> ${err}`);
    }
});

app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);
