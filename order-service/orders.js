const mongoose = require("mongoose");

const notReservedSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    qty: { type: Boolean, required: true },
});

const OrderSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Corresponds to client reference id in stripe
    checkoutid: { type: String, required: true },
    stockchecked: { type: Boolean, required: true },
    notReserved: { type: [notReservedSchema] },
    status: { type: String, enum: ["pending", "accepted", "refunded"], required: true },
}, { versionKey: '__v' });

const OrdersSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Corresponds to userid
    orders: { type: [OrderSchema], required: true },
});

module.exports = Orders = mongoose.model("orders", OrdersSchema);
