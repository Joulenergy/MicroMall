const mongoose = require("mongoose");

/**
 * Connects to service's corresponding mongodb database
 */
async function connect(){
    // ${process.env.RABBIT_USERNAME}-mongo will give eg. product-mongo, which is the mongodb service name
    // docker will replace the service name with its IP address allowing for connection
    const service = process.env.RABBIT_USERNAME
    const dbPath = {"auth":"users", "cart":"carts", "order":"orders", "product":"products"}
    return await mongoose.connect(`mongodb://${service}-mongo:27017/${dbPath[service]}`);
}

module.exports = {
    connect
};