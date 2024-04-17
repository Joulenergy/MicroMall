const amqp = require("amqplib");
const rabbitSettings = {
    protocol: "amqp",
    hostname: "host.docker.internal",
    port: 5672,
    username: `${process.env.RABBIT_USERNAME}`,
    password: `${process.env.RABBIT_PASSWORD}`,
    vhost: "/",
    authMechanism: ["PLAIN", "AMQPLAIN", "EXTERNAL"],
};

const isSocketClosedError = (error) => {
    return error.message === "Socket closed abruptly during opening handshake";
};

let data = {
    responseChannel: null,
    sendChannel: null,
    conn: null,
};

const connectToRabbitMQ = async () => {
    try {
        console.log("Connecting to RabbitMQ...");
        const conn = await amqp.connect(rabbitSettings);
        data.conn = conn;
        console.log("Connected to RabbitMQ");

        // Create channels
        data.responseChannel = await conn.createChannel();
        data.responseChannel.prefetch(1);
        console.log("Response channel created...");

        data.sendChannel = await conn.createConfirmChannel();
        console.log("Send channel created...");
    } catch (error) {
        if (isSocketClosedError(error)) {
            console.error(
                `${error.message}. Retrying connection in 15 seconds...`
            );
            setTimeout(connectToRabbitMQ, 15000);
        } else {
            console.error("Error connecting to RabbitMQ:", error.message);
        }
    }
};

connectToRabbitMQ();

module.exports = data; // export reference to channels