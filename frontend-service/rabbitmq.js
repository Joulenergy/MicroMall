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

let data = {
    conn: null,
};

console.log("Connecting to rabbitmq...");
amqp.connect(rabbitSettings)
    .then((conn) => {
        console.log("Connected to rabbitmq");
        data.conn = conn;
    })
    .catch(console.error);

module.exports = data; // export reference to connection
