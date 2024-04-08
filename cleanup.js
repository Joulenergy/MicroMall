const amqp = require("amqplib");

/**
 * Performs closing of connections for mongoose and rabbitmq
 * @param {string} service 
 * @param {amqp.Connection} conn
 * @param {Array<[string, amqp.Channel]>} channels 
 */
function cleanup(service, conn, channels, server) {
    console.log(`${service} received SIGTERM`);
    try {
        if (server) {
            server.close((err) => {
                if (err) {
                    throw err;
                }
            });
            console.log(`${service} express server closed`);
        }
        if (channels.length !== 0) {
            for (const index in channels) {
                const item = channels[index];
                if (item[1]) {
                    item[1]
                    .close()
                    .then(
                        console.log(
                            `${service} ${item[0]} channel closed`
                        )
                    );
                }
            }
        }
        if (conn) {
            conn.close().then(
                console.log(`${service} RabbitMQ connection closed`)
            );
        }
        if (service !== "frontend-service" && service !== "payment-service") {
            const mongoose = require("mongoose");
            mongoose.connection
            .close()
            .then(
                console.log(`${service} MongoDB connection closed`)
            );
        }
    } catch (err) {
        console.error(
            `Error occurred during ${service} shutdown:`,
            err
        );
    }
}

module.exports = cleanup