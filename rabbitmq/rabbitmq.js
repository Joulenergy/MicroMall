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

function connect() {
    return new Promise(async (res, rej) => {
        const attemptConnection = async () => {
            try {
                console.log("Connecting to RabbitMQ...");
                const conn = await amqp.connect(rabbitSettings);
                res(conn);
            } catch (error) {
                if (isSocketClosedError(error)) {
                    console.error(
                        `${error.message}. Retrying connection in 10 seconds...`
                    );
                    setTimeout(attemptConnection, 10000);
                } else {
                    console.error(
                        "Error connecting to RabbitMQ:",
                        error.message
                    );
                    rej(error);
                }
            }
        };
        attemptConnection();
    });
}

module.exports = {
    connect,
};
