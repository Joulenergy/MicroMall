const rabbitmq = require("./rabbitmq");

async function sendItem(req, queue, msg) {
    // default exchange sending
    try {
        const channel = await rabbitmq.conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        await channel.sendToQueue(
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

async function getResponse(queueName, callback) {
    // uses the sessionid queue to get responses
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
                callback(message, channel);
            },
            { noAck: false }
        );
    } catch (err) {
        console.error(`Error receiving response -> ${err}`);
    }
}

function getResponsePromise(queueName) {
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
                        const data = JSON.parse(message.content.toString())
                        res(data)
                    } catch (err) {
                        rej(err)
                    } finally {
                        channel.ack(message);
                        channel.close()
                    }
                },
                { noAck: false }
            );
        } catch (err) {
            rej(err)
        }
    });
}

module.exports = {
    sendItem,
    getResponse,
    getResponsePromise,
};
