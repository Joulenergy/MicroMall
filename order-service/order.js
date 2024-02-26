"use strict";

const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const Orders = require("./orders");
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const { sendItem, consume } = require("./useRabbit");

Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Product Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(
            conn,
            "create-order",
            async (message, channel) => {
                try {
                    const { checkoutId, sessionid } = JSON.parse(
                        message.content.toString()
                    );

                    // Get client ref id from stripe
                    const session = await stripe.checkout.sessions.retrieve(
                        checkoutId
                    );

                    const orderid = session.client_reference_id.split('-')[1];

                    const newOrder = new Orders({
                        _id: session.customer,
                        orders: [{ _id: orderid, checkoutid: checkoutId }],
                    });
                    await newOrder.save();

                    // Respond to frontend service
                    await sendItem(conn, sessionid, { orderid });

                    channel.ack(message);
                    console.log("Dequeued message...");
                } catch (err) {
                    console.error(`Error Creating Order -> ${err}`);
                }
            },
            "payment"
        );
        consume(conn, "get-orders", async (message, channel) => {
            try {
                const { userId, sessionid } = JSON.parse(
                    message.content.toString()
                );

                // Find all orders with _id matching the regex
                const orders = (await Orders.findById(userId)).orders;

                // Respond to frontend service
                await sendItem(conn, sessionid, orders);

                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                console.error(`Error Getting Orders -> ${err}`);
            }
        });
    })
    .catch((err) => {
        console.log(`Order Service Consuming Error -> ${err}`);
    });
