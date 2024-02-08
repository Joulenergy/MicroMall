"use strict";

const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const Orders = require("./orders");
const {sendItem, consume} = require("./useRabbit");

Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Product Service DB Connected`);
        console.log("RabbitMQ Connected");

        // consume(conn, "catalog", async (message, channel) => {
        //     const { sessionid, all, category } = JSON.parse(
        //         message.content.toString()
        //     );
        //     // possible TODO: category if need to use in future

        //     let products;
        //     if (all) {
        //         products = await Products.find({});
        //     } else {
        //         //possible TODO: in the future if render diff pages with diff category products
        //     }
        //     // Respond to frontend service
        //     await sendItem(conn, sessionid, products);
        //     channel.ack(message);
        //     console.log("Dequeued message...");
        // });
        // consume(conn, "create-product", async (message, channel) => {
        //     const { sessionid, name, quantity, image, price } = JSON.parse(
        //         message.content.toString()
        //     );
        //     const productExists = await Products.findOne({ name });
        //     let fail;
        //     if (productExists) {
        //         fail = true;
        //     } else {
        //         const newProduct = new Products({
        //             name,
        //             quantity:parseInt(quantity),
        //             image,
        //             price,
        //         });
        //         newProduct.save();
        //         fail = false;
        //     }

        //     // Respond to frontend service
        //     const msg = { fail };
        //     await sendItem(conn, sessionid, msg);
        //     channel.ack(message);
        //     console.log("Dequeued message...");
        // });
    })
    .catch((err) => {
        console.log(`Order Service Consuming Error -> ${err}`);
    });
