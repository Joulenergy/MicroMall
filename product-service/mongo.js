const mongoose = require("mongoose");

async function connect(){
    return await mongoose.connect(`mongodb://product-mongo:27017/products`);
}

module.exports = {
    connect
};