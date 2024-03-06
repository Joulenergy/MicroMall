"use strict";

const rabbitmq = require("./rabbitmq");

/**
 * Sends item to queue in rabbitmq with default exchange
 * @param {string} queue
 * @param {Object} msg
 */
async function sendExchange(msg) {
    // fanout exchange sending
    const exchangeName = "payment";
    try {
        await rabbitmq.sendChannel.assertExchange(exchangeName, "fanout", {
            durable: true,
        });

        rabbitmq.sendChannel.publish(
            exchangeName,
            "",
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${exchangeName} exchange...`);
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${exchangeName} exchange -> ${err}`);
    }
}

/**
 * Sends item to queue in rabbitmq with default exchange
 * @param {string} queue
 * @param {Object} msg
 */
async function sendItem(queue, msg) {
    // default exchange sending
    try {
        await rabbitmq.sendChannel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        rabbitmq.sendChannel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify(msg)),
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
 * @param {string} userId
 * @returns {Promise<Object>}
 */
function getResponse(queueName, userId) {
    // uses sessionid queue to get responses to frontend
    return new Promise(async (res, rej) => {
        try {
            await rabbitmq.responseChannel.assertQueue(queueName, {
                durable: true,
            });
            // deletes queue after 30 minutes if unused
            console.log("Queue created...");
            console.log(`Waiting for messages from ${queueName} queue...`);

            // Check for a message for 30 seconds
            const timeoutPromise = new Promise((res, rej) => {
                setTimeout(() => {
                    rej(
                        new Error(
                            `Timeout waiting for response from ${queueName}`
                        )
                    );
                }, 30000);
            });
            const waitForMessage = async () => {
                let corrMsg;
                while (!corrMsg) {
                    let msg = await rabbitmq.responseChannel.get(); // noAck default false
                    if (msg) {
                        const receivedUserId = JSON.parse(msg.content.toString()).userId;
                        if (receivedUserId !== userId) {
                            console.log(
                                "Payment UserId does not match. Rejecting message..."
                            );
                            rabbitmq.responseChannel.nack(msg, false, true);
                        } else {
                            corrMsg = msg
                        }
                    }
                }
                return corrMsg;
            };

            const receivedMsg = await Promise.race([
                waitForMessage(),
                timeoutPromise,
            ]);
            if (receivedMsg) {
                console.log("Received message...");
                const msg = JSON.parse(receivedMsg.content.toString());
                console.log({ msg });
                rabbitmq.responseChannel.ack(receivedMsg);
                console.log("Dequeued message...");
                res(msg.cart);
            }
        } catch (err) {
            rej(err);
        }
    });
}

module.exports = {
    sendExchange,
    getResponse,
    sendItem,
};
