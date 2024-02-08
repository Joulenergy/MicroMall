const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
});

const OrderSchema = new mongoose.Schema({
    userid: { type: String, required: true },
    items: { type: [ItemSchema], required: true },
    totalprice: { type: String, required: true },
});

module.exports = Orders = mongoose.model("orders", OrderSchema);
