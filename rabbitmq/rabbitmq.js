const amqp = require("amqplib")
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
    return error.message === 'Socket closed abruptly during opening handshake';
};

async function connect() {
    try {
        console.log("Connecting to RabbitMQ...");
        const conn = await amqp.connect(rabbitSettings);
        console.log("Connected to RabbitMQ");
        return conn
    } catch (error) {
        if (isSocketClosedError(error)) {
            console.error(`${error.message}. Retrying connection in 10 seconds...`);
            setTimeout(connect, 10000); 
        } else {
            console.error("Error connecting to RabbitMQ:", error.message);
        }
    }      
}

module.exports = {
    connect
};
