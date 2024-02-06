const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const Products = require("./products");

async function consume(conn, queueName, callback) {
    // default exchange consuming
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

async function sendItem(conn, queueName, msg) {
    // default exchange sending
    try {
        const channel = await conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertQueue(queueName, {
            durable: true,
            arguments: { "x-expires": 1800000 },
        });
        // deletes queue after 30 minutes if unused
        console.log("Queue created...");

        await channel.sendToQueue(
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

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Product Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "catalog", async (message, channel) => {
            const { sessionid, all, category } = JSON.parse(
                message.content.toString()
            );
            // category if need to use in future

            let products;
            if (all) {
                products = await Products.find({});
            } else {
                //TODO: in the future if render diff pages with diff category products
            }
            // Respond to frontend service
            await sendItem(conn, sessionid, products);
            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "create-product", async (message, channel) => {
            const { sessionid, name, quantity, image, price } = JSON.parse(
                message.content.toString()
            );
            const productExists = await Products.findOne({ name });
            let fail;
            if (productExists) {
                fail = true;
            } else {
                const newProduct = new Products({
                    name,
                    quantity:parseInt(quantity),
                    image,
                    price,
                });
                newProduct.save();
                fail = false;
            }

            // Respond to frontend service
            const msg = { fail };
            await sendItem(conn, sessionid, msg);
            channel.ack(message);
            console.log("Dequeued message...");
        });
    })
    .catch((err) => {
        console.log(`Product Service Consuming Error -> ${err}`);
    });
