const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Corresponds to product-mongo id
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, minLength: 3 },
});

const CartSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true }, // Corresponds to userid
        items: { type: [ItemSchema], required: true },
    },
    { versionKey: "__v" }
);

module.exports = Carts = mongoose.model("carts", CartSchema);
