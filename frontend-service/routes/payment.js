const express = require("express");
const { sendItem, getResponse } = require("../useRabbit");
const checkstocks = require("../checkstocks");
const router = express.Router();

router.post("/checkstocks", async (req, res) => {
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

router.post("/pay", (req, res) => {
    req.session.payment = true;
    res.end();
});

router.get("/success", async (req, res) => {
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

router.get("/cancel", (req, res) => {
    if (req.session.payment) {
        res.send(
            '<h2>Need more time to browse your cart?</h2><a href="/">Back to catalog page</a>'
        );
        req.session.payment = false;
    } else {
        res.redirect("/");
    }
});

module.exports = router;
