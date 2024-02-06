const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {type: String, required: true},
    quantity: {type: Number, required: true},
    image: {data: {type: Buffer, required: true},  
            contentType: {type: String, required: true}},
    price: {type: String, required: true}
});

module.exports = Products = mongoose.model("products", ProductSchema);