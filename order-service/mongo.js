const mongoose = require("mongoose");

async function connect(){
    return await mongoose.connect(`mongodb://order-mongo:27017/orders`);
}

module.exports = {
    connect
};