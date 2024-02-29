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
                    const { checkoutId } = JSON.parse(
                        message.content.toString()
                    );

                    // Get client ref id from stripe
                    const session = await stripe.checkout.sessions.retrieve(
                        checkoutId
                    );

                    const [userId, orderTime] =
                        session.client_reference_id.split("-");

                    // Check if customer exists already
                    const customer = await Orders.findById(userId);

                    if (customer) {
                        // Create order under customer
                        customer.orders.push({
                            _id: orderTime,
                            checkoutid: checkoutId,
                            stockchecked: false,
                        });
                        await customer.save();
                    } else {
                        // Create new order under customer
                        const newOrder = new Orders({
                            _id: userId,
                            orders: [
                                {
                                    _id: orderTime,
                                    checkoutid: checkoutId,
                                    stockchecked: false,
                                },
                            ],
                        });
                        await newOrder.save();
                    }

                    const sessionid = session.metadata.sessionid;
                    console.log({sessionid});
                    
                    // Respond to frontend service
                    await sendItem(conn, sessionid, { orderTime });

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
        consume(conn, "stock-reserved", async (message, channel) => {
            try {
                const { orderId, notReserved } = JSON.parse(
                    message.content.toString()
                );

                const [userId, orderTime] = orderId.split("-");

                // Find the specific order
                const orders = await Orders.findById(userId);
                const order = orders.orders.filter((order) => {
                    return order._id === orderTime;
                })[0];

                if (!order) {
                    // Order may not have been created yet
                    channel.nack(message, false, true); // requeue message
                }

                // update the order
                order.stockchecked = true;
                order.notReserved = notReserved;
                await orders.save();
                console.log("Order stockcheck status updated!");

                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                console.error(`Error Updating Stock Reserved Status -> ${err}`);
            }
        });
    })
    .catch((err) => {
        console.log(`Order Service Consuming Error -> ${err}`);
    });
