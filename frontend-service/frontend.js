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

// Ensure user does not access pages without logging in
app.use((req, res, next) => {
    if (!req.session.userId && !["/login", "/register"].includes(req.path)) {
        // user has not login yet
        res.redirect("/login");
    } else if (
        // admin only path - create product
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

// Payment router
const payRouter = require("./routes/payment");
app.use("/", payRouter);

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
