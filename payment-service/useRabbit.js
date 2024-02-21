"use strict";

const rabbitmq = require("./rabbitmq");

/**
 * Sends item to queue in rabbitmq with default exchange
 * @param {string} queue
 * @param {Object} msg
 */
async function sendExchange(queue, msg) {
    // fanout exchange sending
    const exchangeName = "payment";   
    try {
        await rabbitmq.sendChannel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        await rabbitmq.sendChannel.assertExchange(exchangeName, 'fanout', {durable: true});

        rabbitmq.sendChannel.publish(
            exchangeName,
            '',
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
                arguments: { "x-expires": 1800000 },
            });
            // deletes queue after 30 minutes if unused
            console.log("Queue created...");
            console.log(`Waiting for messages from ${queueName} queue...`);

            const { consumerTag } = await rabbitmq.responseChannel.consume(
                queueName,
                (message) => {
                    console.log("Received message...");
                    try {
                        const msg = JSON.parse(message.content.toString());
                        console.log({ msg });
                        if (msg.userId !== userId) {
                            rabbitmq.responseChannel.nack(message, false, true);
                        } else {
                            rabbitmq.responseChannel.ack(message);
                            console.log("Dequeued message...");
                            rabbitmq.responseChannel.cancel(consumerTag);
                            res(msg);
                        }
                    } catch (err) {
                        rej(err);
                    }
                },
                { noAck: false }
            );

            setTimeout(() => {
                rabbitmq.responseChannel.cancel(consumerTag); // Cancel the consumer
                rej(new Error("Timeout waiting for response"));
            }, 30000); // wait for response for 30 seconds
        } catch (err) {
            rej(err);
        }
    });
}

module.exports = {
    sendExchange,
    getResponse,
    sendItem
};
