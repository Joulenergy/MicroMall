const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Corresponds to client reference id in stripe
    checkoutid: { type: String, required: true },
});

const OrdersSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Corresponds to userid
    orders: { type: [OrderSchema], required: true },
});

module.exports = Orders = mongoose.model("orders", OrdersSchema);
