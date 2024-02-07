"use strict";

const Carts = require("./carts");
const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const { consume, sendItem } = require("./useRabbit");

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
                const index = cart.products.indexOf(name);

                // Check if product is already in cart
                if (index == -1) {
                    // Product is not in cart
                    cart.products.push(name);
                    cart.quantities.push(qty);
                    cart.prices.push(price);
                } else {
                    // Product in cart already
                    const newqty = cart.quantities[index] + qty;
                    if (0 < newqty && newqty <= maxqty) {
                        // Ensure user does not add to cart more than stock amount, maxqty
                        cart.quantities[index] += qty;
                    } else if (cart.quantities[index] + qty == 0) {
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
