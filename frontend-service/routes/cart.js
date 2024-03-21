const express = require("express");
const { sendItem, getResponse } = require("../useRabbit");
const router = express.Router();

router.post("/addtocart", async (req, res) => {
    const { itemid, name, price, qty, maxqty } = req.body;
    try {
        await sendItem(req, "change-cart", {
            id: req.session.userId,
            itemid,
            name,
            price,
            qty,
            maxqty,
        });
        await getResponse(req.sessionID, req.session.corrId);
        res.redirect("/");
    } catch (err) {
        console.error(`Error adding to cart -> ${err}`);
        res.send(
            "Something went wrong while trying to add to cart. Please try again later"
        );
    }
});

router.post("/changecart", async (req, res) => {
    const { name, qty, maxqty } = req.body;
    try {
        sendItem(req, "change-cart", {
            id: req.session.userId,
            name,
            qty,
            maxqty,
        });
        await getResponse(req.sessionID, req.session.corrId);
        res.json({ refresh: true });
    } catch (err) {
        console.error(`Error changing cart -> ${err}`);
        res.json({ refresh: false });
    }
});

router.post("/cartstate", (req, res) => {
    // toggles cart open state
    req.session.showcart = !req.session.showcart;
    res.end();
});

module.exports = router;
