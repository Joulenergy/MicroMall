const amqp = require("amqplib");
const rabbitSettings = {
    protocol: "amqp",
    hostname: "host.docker.internal",
    port: 5672,
    username: "frontend",
    password: "frontend",
    vhost: "/",
    authMechanism: ["PLAIN", "AMQPLAIN", "EXTERNAL"],
};
let isConnected = false;

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
        isConnected = true;

        // Create channels
        data.responseChannel = await conn.createChannel();
        data.responseChannel.prefetch(1);
        console.log("Response channel created...");

        data.sendChannel = await conn.createConfirmChannel();
        console.log("Send channel created...");
    } catch (error) {
        if (isSocketClosedError(error) && !isConnected) {
            console.error(
                `${error.message}. Retrying connection in 20 seconds...`
            );
            setTimeout(connectToRabbitMQ, 20000);
        } else {
            console.error("Error connecting to RabbitMQ:", error.message);
        }
    }
};

connectToRabbitMQ();

module.exports = data; // export reference to channels
