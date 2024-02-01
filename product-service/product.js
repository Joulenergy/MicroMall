const rabbitmq = require('./rabbitmq');
const mongo = require('./mongo');
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

async function sendItem(conn, routingKey, msg) {
    // direct exchange sending
    const exchangeName = "product";

    try {
        const channel = await conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertExchange(exchangeName, "direct", { durable: true });
        console.log("Exchange created...");

        channel.publish(
            exchangeName,
            routingKey,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${exchangeName} exchange...`);
                    channel.close();
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${exchangeName} exchange -> ${err}`);
    }
}

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Product Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "catalog", async (message, channel) => {
            const { id, all, category } = JSON.parse(message.content.toString());
            // category if need to use in future 

            let products;
            if (all) {
                products = await Products.find({})
            } else {
                //TODO: in the future if render diff pages with diff category products
            }
            console.log('here')
            // Respond to frontend service
            await sendItem(conn, id, products);
            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "create-product", async (message, channel) => {
            const { id, name, quantity, image, price } = JSON.parse(
                message.content.toString()
            );
            const productExists = await Products.findOne({ name });
            let fail;
            if (productExists) {
                fail = true;
            } else {
                const newProduct = new Products({
                    name,
                    quantity,
                    image,
                    price
                });
                newProduct.save();
                fail = false;
            }

            // Respond to frontend service
            const msg = { fail };
            await sendItem(conn, id, msg);
            channel.ack(message);
            console.log("Dequeued message...");
        });
    })
    .catch((err) => {
        console.log(`Product Service Consuming Error -> ${err}`);
    });

