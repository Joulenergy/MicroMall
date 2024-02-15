"use strict";

const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const Products = require("./products");
const {sendItem, consume} = require("./useRabbit");

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Product Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "catalog", async (message, channel) => {
            const { sessionid, all, productIds } = JSON.parse(
                message.content.toString()
            );
            
            // Get products for db
            let products;
            if (all) {
                products = await Products.find({});
            } else {
                // possible TODO: use categories to get products
                products = await Products.find({ _id: { $in: productIds } });
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
