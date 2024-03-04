"use strict";

const Carts = require("./carts");
const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const { consume, sendItem } = require("./useRabbit");
const mongoose = require("mongoose");

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log("Cart Service DB Connected");
        console.log("RabbitMQ Connected");

        consume(
            conn,
            "delete-cart",
            async (message, channel) => {
                try {
                    const { userId } = JSON.parse(message.content.toString());
                    console.log("Attempting to delete cart", userId);
                    
                    // Retrieve the cart by its ID
                    const cart = await Carts.findById(userId);

                    if (!cart) {
                        channel.nack(message, false, false);
                        throw new Error("Cart not found");
                    }

                    // Delete the cart
                    await Carts.findByIdAndDelete(userId);

                    console.log("Cart deleted successfully");

                    channel.ack(message);
                    console.log("Dequeued message...");
                } catch (err) {
                    if (err instanceof mongoose.Error.VersionError) {
                        console.log(
                            "Concurrency conflict: Another process modified the cart. Requeuing message"
                        );
                        // Handle concurrency conflict by requeuing edit
                        channel.nack(message, false, true);
                    } else {
                        console.error(`Error Deleting Cart -> ${err}`);
                    }
                }
            },
            "payment"
        );
        consume(conn, "change-cart", async (message, channel) => {
            try {
                let { corrId, itemid, sessionid, id, name, price, qty, maxqty } =
                    JSON.parse(message.content.toString());
                qty = parseInt(qty);
                maxqty = parseInt(maxqty);

                let cart;
                cart = await Carts.findById(id);

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
                        cart.items.push({
                            _id: itemid,
                            name,
                            quantity: qty,
                            price,
                        });
                        await cart.save();
                    } else {
                        // Product in cart already
                        const item = cart.items[itemIndex];
                        const newqty = item.quantity + qty;
                        if (0 < newqty && newqty <= maxqty) {
                            // Ensure user does not add to cart more than stock amount, maxqty
                            item.quantity += qty;
                            await cart.save();
                        } else if (newqty == 0) {
                            // Remove item
                            cart.items.splice(itemIndex, 1);
                            await cart.save();

                            if (cart.items.length == 0) {
                                // delete empty cart
                                await Carts.findByIdAndDelete(id);
                            }
                        } else {
                            // User is trying to add item but not enough stock
                            item.quantity = maxqty;
                            await cart.save();
                        }
                    }
                } else {
                    if (!id) {
                        channel.nack(message, false, false);
                    } else {
                        // Create new cart
                        const newCart = new Carts({
                            _id: id,
                            items: [
                                { _id: itemid, name, quantity: qty, price },
                            ],
                        });

                        await newCart.save();
                    }
                }

                // Respond to frontend service
                await sendItem(conn, sessionid, {corrId, fail: false});

                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                if (err instanceof mongoose.Error.VersionError) {
                    console.error(
                        "Concurrency conflict: Another process modified the cart"
                    );
                    // Handle concurrency conflict by requeuing edit
                    channel.nack(message, false, true);
                } else {
                    console.error(`Error Changing Cart -> ${err}`);
                }
            }
        });
        consume(conn, "get-cart", async (message, channel) => {
            const { corrId, sessionid, id } = JSON.parse(message.content.toString());
            let cart = await Carts.findById(id);

            // Respond to frontend service
            if (cart === null) {
                cart = {};
            }

            if (sessionid === "payment") {
                await sendItem(conn, sessionid, { cart, userId: id });
            } else {
                await sendItem(conn, sessionid, { corrId, cart });
            }

            channel.ack(message);
            console.log("Dequeued message...");
        });
    })
    .catch((err) => {
        console.error(`Cart Service Consuming Error -> ${err}`);
    });
