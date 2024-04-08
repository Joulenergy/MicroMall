"use strict";

const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const Orders = require("./orders");
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const { consume, sendItem, channels } = require("./useRabbit");
const cleanup = require("./cleanup");

/**
 * Issue a full refund for a payment
 * @param {String} payment_intent
 * @param {String|undefined} reason
 * @returns
 */
async function issueRefund(payment_intent, reason) {
    try {
        let refund;
        if (reason) {
            refund = await stripe.refunds.create({
                payment_intent,
                reason,
            });
        } else {
            refund = await stripe.refunds.create({
                payment_intent,
            });
        }
        console.log("Refund issued:", refund);
        return;
    } catch (error) {
        throw error;
    }
}

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
                            status: "pending",
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
                                    status: "pending",
                                },
                            ],
                        });
                        await newOrder.save();
                    }

                    const sessionid = session.metadata.sessionid;

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
                const { corrId, userId, sessionid } = JSON.parse(
                    message.content.toString()
                );

                // Find all orders with _id matching the regex
                const orders = (await Orders.findById(userId)).orders;

                // Respond to frontend service
                await sendItem(conn, sessionid, { corrId, orders });

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
                    setTimeout(() => {
                        channel.nack(message, false, true);
                    }, 5000); // requeue message
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
        consume(conn, "refund", async (message, channel) => {
            const { corrId, sessionid, orderId, reason } = JSON.parse(
                message.content.toString()
            );
            // reasons: duplicate, fraudulent, or requested_by_customer
            try {
                const [userId, orderTime] = orderId.split("-");

                // Find the specific order
                const orders = await Orders.findById(userId);

                let fail = true;
                let order;
                if (orders) {
                    order = orders.orders.filter((order) => {
                        return order._id === orderTime;
                    })[0];
                }

                if (order) {
                    // get checkout session from stripe
                    const session = await stripe.checkout.sessions.retrieve(
                        order.checkoutid,
                        {
                            expand: [
                                "line_items",
                                "line_items.data.price.product",
                            ],
                        }
                    );

                    if (reason) {
                        await issueRefund(session.payment_intent, reason);
                    } else {
                        await issueRefund(session.payment_intent);
                    }

                    // extract items and quantities that were ordered
                    const lineItems = session.line_items.data;
                    console.log({ lineItems });

                    lineItems.forEach((item) => {
                        // send event to product-service to add back products
                        sendItem(conn, "change-product", {
                            productId: item.price.product.metadata.id,
                            qty: item.quantity,
                        });
                    });

                    // update order status
                    order.status = "refunded";
                    await orders.save();
                    console.log("Order status updated to refunded!")

                    fail = false;
                }

                // Respond to frontend service
                await sendItem(conn, sessionid, { corrId, fail });
                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                await sendItem(conn, sessionid, { corrId, fail: true });
                channel.ack(message);
                console.log("Dequeued message...");
                console.error(`Error Refunding -> ${err}`);
            }
        });
        consume(conn, "accept-order", async (message, channel) => {
            const { corrId, sessionid, orderId } = JSON.parse(
                message.content.toString()
            );
            try {
                const [userId, orderTime] = orderId.split("-");

                // Find the specific order
                const orders = await Orders.findById(userId);

                let fail = true;
                let order;
                if (orders) {
                    order = orders.orders.filter((order) => {
                        return order._id === orderTime;
                    })[0];
                }

                if (order) {
                    if (order.status === "pending") {
                        console.log(`Accepting order ${orderId}...`)
                        // update order status
                        order.status = "accepted";
                        await orders.save();

                        fail = false;
                    }
                }

                // Respond to frontend service
                await sendItem(conn, sessionid, { corrId, fail });
                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                await sendItem(conn, sessionid, { corrId, fail: true });
                channel.ack(message);
                console.log("Dequeued message...");
                console.error(`Error Accepting Order -> ${err}`);
            }
        });
        process.on("SIGTERM", () => {
            cleanup("order-service", conn, channels);
        });
    })
    .catch((err) => {
        console.log(`Order Service Consuming Error -> ${err}`);
    });
