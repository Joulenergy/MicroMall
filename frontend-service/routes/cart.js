const express = require("express");
const { sendItem } = require("../useRabbit");
const router = express.Router();

router.post("/addtocart", async (req, res) => {
    const { name, price, qty, maxqty } = req.body;
    await sendItem(req, "change-cart", {
        id: req.session.userId,
        name,
        price,
        qty,
        maxqty,
    });
    req.session.showcart = true;
    res.redirect("/");
});

router.post("/changecart", (req, res) => {
    const { name, qty, maxqty } = req.body;
    sendItem(req, "change-cart", {
        id: req.session.userId,
        name,
        qty,
        maxqty,
    });
    res.end();
});

router.post("/cartstate", (req, res) => {
    // toggles cart open state
    req.session.showcart = !req.session.showcart;
    res.end();
});

module.exports = router;
