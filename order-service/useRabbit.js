"use strict";

const amqp = require("amqplib");
let sendChannel;

/**
 * Consumes from a queue using the default exchange
 * @param {amqp.Connection} conn
 * @param {string} queueName
 * @param {(message: amqp.ConsumeMessage, channel:amqp.Channel) => void} callback
 */
async function consume(conn, queueName, callback, exchangeName) {
    try {
        const channel = await conn.createChannel();
        console.log("Channel created...");

        const q = await channel.assertQueue(queueName, { durable: true });
        console.log("Queue created...");

        channel.prefetch(1); // not realistic setting, allows for simulating fair distribution of tasks

        if (exchangeName) {
            await channel.assertExchange(exchangeName, 'fanout', {durable: true});
            console.log(`${exchangeName} exchange created...`);

            channel.bindQueue(q.queue, exchangeName, '')
        }

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
        if (!sendChannel) {
            sendChannel = await conn.createConfirmChannel();
            console.log("Send channel created...");
        }
        
        if (queueName === "change-product") {
            await sendChannel.assertQueue(queueName, {
                durable: true,
            });
        } else {
            await sendChannel.assertQueue(queueName, {
                durable: true,
                arguments: { "x-expires": 1800000 },
            }); // deletes queue after 30 minutes if unused
        }
        console.log("Queue created...");

        sendChannel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queueName} queue...`);
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${queueName} queue -> ${err}`);
        throw err // propogate error to the calling code
    }
}

module.exports = {
    sendItem,
    consume,
};