"use strict";

const express = require("express");
const session = require("express-session");
const { sendItem, getResponse } = require("./useRabbit");
const checkstocks = require("./checkstocks");
const rabbitmq = require("./rabbitmq");
const cleanup = require("./cleanup");
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
// TODO: add mongodb session store?

// Ensure user does not access pages without logging in
app.use((req, res, next) => {
    if (!req.session.userId && !["/login", "/register"].includes(req.path)) {
        // user has not login yet
        res.redirect("/login");
    } else if (
        req.session.type !== "admin" &&
        ["/createproduct"].includes(req.path)
    ) {
        res.redirect("/");
    } else {
        next();
    }
});

app.get("/", async (req, res) => {
    // product catalog page
    try {
        const showcart = req.session.showcart === true;

        // Ask product service to send data
        sendItem(req, "catalog", { all: true });

        // Get response from product service
        const { products } = await getResponse(
            req.sessionID,
            req.session.corrId
        );
        console.log({ products });

        // ask cart service to send data
        sendItem(req, "get-cart", { id: req.session.userId });

        let { cart } = await getResponse(req.sessionID, req.session.corrId);
        console.log({ cart });

        if (JSON.stringify(cart) == "{}") {
            res.render("catalog", {
                showcart,
                productitems: products,
                cartitems: {},
                alertmsg: "",
            });
        } else {
            let alertmsg;
            [cart, alertmsg] = await checkstocks(req, products, cart);
            console.log({ cartbeforerender: cart });
            console.log({ alertmsgbeforerender: alertmsg });

            res.render("catalog", {
                showcart,
                productitems: products,
                cartitems: cart.items,
                alertmsg,
            });
        }
    } catch (err) {
        console.log(`Error loading catalog page -> ${err}`);
        res.send(
            "Something went wrong loading the catalog page. Please try again later"
        );
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

        let { cart } = await getResponse(req.sessionID, req.session.corrId);
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
        const { products } = await getResponse(
            req.sessionID,
            req.session.corrId
        );
        console.log({ products });

        let alertmsg;
        [cart, alertmsg] = await checkstocks(req, products, cart);
        console.log({ cartitems: cart.items });
        console.log({ alertmsg });

        res.render("confirm", {
            sessionid: req.sessionID,
            name: req.session.name,
            email: req.session.email,
            userId: req.session.userId,
            productitems: products,
            cartitems: cart.items,
            alertmsg,
        });
    } catch (err) {
        console.error(`Error checking stocks -> ${err}`);
        res.send(
            "Something went wrong loading while checking for available stocks. Please try again later"
        );
    }
});

app.post("/pay", (req, res) => {
    req.session.payment = true;
    res.end();
});

app.get("/success", async (req, res) => {
    if (req.session.payment) {
        try {
            const { orderTime } = await getResponse(req.sessionID);
            res.send(
                `<h2>Thank you for your order!</h2><p>OrderId: ${orderTime}</p><a href="/">Back to catalog page</a>`
            );
        } catch (err) {
            res.send("Thank you for your order!");
            console.error(
                `OrderId not received by frontend for userId: ${req.session.userId}`
            );
        }
        // TODO: view all orders page
        req.session.payment = false;
    } else {
        res.redirect("/");
    }
});

app.get("/cancel", (req, res) => {
    if (req.session.payment) {
        res.send(
            '<h2>Need more time to browse your cart?</h2><a href="/">Back to catalog page</a>'
        );
        req.session.payment = false;
    } else {
        res.redirect("/");
    }
});

const server = app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);

// handle graceful shutdown
process.on("SIGTERM", () => {
    const channels = [
        ["response", rabbitmq.responseChannel],
        ["send", rabbitmq.sendChannel],
    ];
    cleanup("frontend-service", rabbitmq.conn, channels, server);
});
