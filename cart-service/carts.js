const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
    id: {type: String, required: true},
    products: {type: [String], required: true},
    quantities: {type: [Number], required: true},
    prices: {type: [String], required: true}
});

module.exports = Carts = mongoose.model("carts", CartSchema);