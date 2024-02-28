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
        await rabbitmq.sendChannel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        rabbitmq.sendChannel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify({ ...msg, sessionid: req.sessionID })),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queue} queue...`);
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
            await rabbitmq.responseChannel.assertQueue(queueName, {
            durable: true,
            arguments: { "x-expires": 1800000 },
            });
            // deletes queue after 30 minutes if unused
            console.log("Queue created...");
            console.log(`Waiting for messages from ${queueName} queue...`);
            
            // Check for a message for 30 seconds
            const timeoutPromise = new Promise((res, rej) => {
                setTimeout(() => {
                    rej(new Error(`Timeout waiting for response from ${queueName}`));
                }, 30000);
            });
            const waitForMessage = async () => {
                let msg;
                    while (!msg) {
                    msg = await rabbitmq.responseChannel.get(); // noAck default false
                }
                return msg;
            }

            const receivedMsg = await Promise.race([waitForMessage(), timeoutPromise]);
            if (receivedMsg) {
                console.log("Received message...");
                try {
                    const msg = JSON.parse(receivedMsg.content.toString());
                    console.log({msg})
                    res(msg);
                } catch (err) {
                    rej(err)
                } finally {
                    rabbitmq.responseChannel.ack(receivedMsg);
                    console.log("Dequeued message...");
                }
            }
        } catch (err) {
            rej(err);
        }
    });           
}

module.exports = {
    sendItem,
    getResponse,
};
