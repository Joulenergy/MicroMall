"use strict";

const rabbitmq = require("./rabbitmq");
const express = require("express");

/**
 * Sends item to queue in rabbitmq with default exchange
 * @param {express.Request} req
 * @param {string} queue
 * @param {Object} msg
 */
async function sendItem(req, queue, msg) {
    // default exchange sending
    try {
        const channel = await rabbitmq.conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        channel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify({ ...msg, sessionid: req.sessionID })),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queue} queue...`);
                    channel.close();
                    console.log("Channel closed...");
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${queue} queue -> ${err}`);
    }
}

/**
 * Gets response to frontend using sessionid of user using promises
 * @param {string} queueName
 * @returns {Promise<Object>}
 */
function getResponse(queueName) {
    // uses sessionid queue to get responses to frontend
    return new Promise(async (res, rej) => {
        try {
            const channel = await rabbitmq.conn.createConfirmChannel();
            console.log("Channel created...");

            await channel.assertQueue(queueName, {
                durable: true,
                arguments: { "x-expires": 1800000 },
            });
            // deletes queue after 30 minutes if unused
            console.log("Queue created...");
            console.log(`Waiting for messages from ${queueName} queue...`);

            channel.consume(
                queueName,
                (message) => {
                    console.log(`Received message...`);
                    try {
                        const msg = JSON.parse(message.content.toString());
                        console.log({msg})
                        res(msg);

                    } catch (err) {
                        rej(err);

                    } finally {
                        channel.ack(message);
                        console.log("Dequeued message...");
                        channel.close();
                        console.log("Channel closed...");
                    }
                },
                { noAck: false }
            );
        } catch (err) {
            rej(err);
        }
    });
}

module.exports = {
    sendItem,
    getResponse,
};
