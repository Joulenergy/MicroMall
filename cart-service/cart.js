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
            let { sessionid, id, name, price, qty, maxqty } = JSON.parse(
                message.content.toString()
            );
            qty = parseInt(qty);
            maxqty = parseInt(maxqty);
            
            let cart;
            cart = await Carts.findOne({ _id: id });

            if (cart) {
                // Add product to current cart
                let itemIndex = -1;

                // Check if product is already in cart
                cart.items.forEach((item, index) => {
                    if (item.name == name) {
                        itemIndex = index;
                    }
                });

                if (itemIndex == -1) {
                    // Product is not in cart
                    cart.items.push({ name, quantity: qty, price });
                    cart.save();
                    
                } else {
                    // Product in cart already
                    const item = cart.items[itemIndex];
                    const newqty = item.quantity + qty;
                    if (0 < newqty && newqty <= maxqty) {
                        // Ensure user does not add to cart more than stock amount, maxqty
                        item.quantity += qty;
                        cart.save();
                        
                    } else if (newqty == 0) {
                        // Remove item
                        cart.items.splice(itemIndex, 1);
                        cart.save();

                        if (cart.items.length == 0) {
                            // delete empty cart
                            await Carts.deleteOne({ _id: id });
                        }
                    } else {
                        // User is trying to add item but not enough stock
                        item.quantity = maxqty;
                        cart.save();
                    }
                }
            } else {
                if (!id) {
                    channel.nack(message, false, false);
                } else {
                    // Create new cart
                    const newCart = new Carts({
                        _id: id,
                        items: [{ name, quantity: qty, price }],
                    });

                    await newCart.save();
                }
            }

            // Respond to frontend service
            await sendItem(conn, sessionid, "success");

            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "get-cart", async (message, channel) => {
            const { sessionid, id } = JSON.parse(message.content.toString());
            let cart = await Carts.findOne({ _id: id });

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
