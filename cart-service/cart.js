const Carts = require("./carts");
const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");

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
        console.log("Cart Service DB Connected");
        console.log("RabbitMQ Connected");

        consume(conn, "change-cart", async (message, channel) => {
            let { id, name, price, qty, maxqty } = JSON.parse(
                message.content.toString()
            );
            qty = parseInt(qty);
            maxqty = parseInt(maxqty);

            const cart = await Carts.findOne({ id });
            if (cart) {
                // Add product to current cart
                index = cart.products.indexOf(name);

                // Check if product is already in cart
                if (index == -1) {
                    // Product is not in cart
                    cart.products.push(name);
                    cart.quantities.push(qty);
                    cart.prices.push(price);
                } else {
                    // Product in cart already
                    const newqty = cart.quantities[index] + qty
                    if (0 < newqty && newqty <= maxqty) {
                        // Ensure user does not add to cart more than stock amount, maxqty
                        cart.quantities[index] += qty;
                        
                    } else if ((cart.quantities[index] + qty) == 0) {
                        // Remove item
                        cart.quantities.splice(index, 1);
                        cart.products.splice(index, 1);
                        cart.prices.splice(index, 1);

                    } else {
                        cart.quantities[index] = maxqty;
                    }
                }

                cart.save();
            } else {
                // Create new cart
                const newCart = new Carts({
                    id,
                    products: [name],
                    quantities: [qty],
                    prices: [price],
                });

                newCart.save();
            }

            // no need respond to frontend? (for now) - but need to consider how to at frontend prevent user
            // rather than use the maxqty here or give some form of response that cannot add more to cart

            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "get-cart", async (message, channel) => {
            const { sessionid, id } = JSON.parse(message.content.toString());
            let cart = await Carts.findOne({ id });

            // Respond to frontend service
            if (cart === null) {
                cart = {};
            }
            await sendItem(conn, sessionid, cart);
            channel.ack(message);
            console.log("Dequeued message...");
        });
    })
    .catch((err) => {
        console.log(`Cart Service Consuming Error -> ${err}`);
    });
