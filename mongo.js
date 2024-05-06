const mongoose = require("mongoose");

/**
 * Connects to service's corresponding mongodb database
 */
async function connect(){
    // ${process.env.RABBIT_USERNAME}-mongo will give eg. product-mongo, which is the mongodb service name
    // docker will replace the service name with its IP address allowing for connection
    return await mongoose.connect(`mongodb://${process.env.RABBIT_USERNAME}-mongo:27017/users`);
}

module.exports = {
    connect
};