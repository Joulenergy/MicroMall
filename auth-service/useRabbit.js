"use strict";

const amqp = require("amqplib");

/**
 * Consumes from a queue using the default exchange
 * @param {amqp.Connection} conn
 * @param {string} queueName
 * @param {(message: amqp.ConsumeMessage, channel:amqp.Channel) => void} callback
 */
async function consume(conn, queueName, callback) {
    try {
        const channel = await conn.createChannel();
        console.log("Channel created...");

        await channel.assertQueue(queueName, { durable: true });
        console.log("Queue created...");

        channel.prefetch(1); // not realistic setting, allows for simulating fair distribution of tasks

        console.log(`Waiting for messages from ${queueName} queue...`);

        channel.consume(
            queueName,
            (message) => {
                console.log("Received message...");
                callback(message, channel);
            },
            { noAck: false }
        );
    } catch (err) {
        console.error(`Error consuming from ${queueName} queue -> ${err}`);
    }
}

/**
 * Sends item to queue in rabbitmq with default exchange
 * @param {amqp.Connection} conn
 * @param {string} queueName
 * @param {Object} msg
 */
async function sendItem(conn, queueName, msg) {
    try {
        const channel = await conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertQueue(queueName, {
            durable: true,
            arguments: { "x-expires": 1800000 },
        });
        // deletes queue after 30 minutes if unused
        console.log("Queue created...");

        channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queueName} queue...`);
                    channel.close();
                    console.log("Channel closed...");
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${queueName} queue -> ${err}`);
    }
}

module.exports = {
    sendItem,
    consume,
};
