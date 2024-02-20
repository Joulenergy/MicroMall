"use strict";

const {sendChannel,responseChannel} = require("./rabbitmq");

/**
 * Sends item to queue in rabbitmq with default exchange
 * @param {string} queue
 * @param {Object} msg
 */
async function sendExchange(queue, msg) {
    // fanout exchange sending
    try {
        await sendChannel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        await sendChannel.assertExchange('payment', 'fanout', {durable: true});

        sendChannel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queue} queue...`);
                    sendChannel.close();
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
 * @param {string} userId
 * @returns {Promise<Object>}
 */
function getResponse(queueName, userId) {
    // uses sessionid queue to get responses to frontend
    return new Promise(async (res, rej) => {
        try {
            await responseChannel.assertQueue(queueName, {
                durable: true,
                arguments: { "x-expires": 1800000 },
            });
            // deletes queue after 30 minutes if unused
            console.log("Queue created...");
            console.log(`Waiting for messages from ${queueName} queue...`);

            const { consumerTag } = await responseChannel.consume(
                queueName,
                (message) => {
                    console.log("Received message...");
                    try {
                        const msg = JSON.parse(message.content.toString());
                        console.log({ msg });
                        if (msg.userId !== userId) {
                            responseChannel.nack(message, false, true);
                        } else {
                            responseChannel.ack(message);
                            console.log("Dequeued message...");
                            responseChannel.cancel(consumerTag);
                            res(msg);
                        }
                    } catch (err) {
                        rej(err);
                    }
                },
                { noAck: false }
            );

            setTimeout(() => {
                responseChannel.cancel(consumerTag); // Cancel the consumer
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
};
