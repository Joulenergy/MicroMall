const mongoose = require("mongoose");

async function connect(){
    return await mongoose.connect(`mongodb://cart-mongo:27017/carts`);
}

module.exports = {
    connect
};