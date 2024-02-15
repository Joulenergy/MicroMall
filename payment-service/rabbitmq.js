const amqp = require("amqplib")
const rabbitSettings = {
    protocol: "amqp",
    hostname: "host.docker.internal",
    port: 5672,
    username: "payment",
    password: "payment",
    vhost: "/",
    authMechanism: ["PLAIN", "AMQPLAIN", "EXTERNAL"],
};

let data = {
    conn: null,
    responseChannel: null,
};

console.log("Connecting to rabbitmq...");
amqp.connect(rabbitSettings)
    .then(async (conn) => {
        console.log("Connected to rabbitmq");
        data.conn = conn;
        data.responseChannel = await conn.createChannel();
        data.responseChannel.prefetch(1);
        console.log("Response channel created...");
    })
    .catch(console.error);

module.exports = data; // export reference to connection
