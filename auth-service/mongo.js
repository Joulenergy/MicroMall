const mongoose = require("mongoose");

async function connect(){
    return await mongoose.connect(`mongodb://auth-mongo:27017/users`);
}

module.exports = {
    connect
}; // export reference to connection