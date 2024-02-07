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

module.exports = router;
