const amqp = require("amqplib")
const rabbitSettings = {
    protocol: "amqp",
    hostname: "host.docker.internal",
    port: 5672,
    username: "guest",
    password: "guest",
    vhost: "/",
    authMechanism: ["PLAIN", "AMQPLAIN", "EXTERNAL"],
};

async function connect(){
    return await amqp.connect(rabbitSettings)         
}

module.exports = {
    connect
};
