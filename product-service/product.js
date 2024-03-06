"use strict";

const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");
const Products = require("./products");
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const { sendItem, consume } = require("./useRabbit");

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Product Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "catalog", async (message, channel) => {
            const { corrId, sessionid, all, productIds } = JSON.parse(
                message.content.toString()
            );

            // Get products from db
            let products;
            if (all) {
                products = await Products.find({});
            } else {
                // possible TODO: use categories to get products
                products = await Products.find({ _id: { $in: productIds } });
            }
            // Respond to frontend service
            await sendItem(conn, sessionid, { corrId, products });
            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "create-product", async (message, channel) => {
            const { corrId, sessionid, name, quantity, image, price } =
                JSON.parse(message.content.toString());
            const productExists = await Products.findOne({ name });
            let fail;
            if (productExists) {
                fail = true;
            } else {
                const newProduct = new Products({
                    name,
                    quantity: parseInt(quantity),
                    image,
                    price,
                });
                newProduct.save();
                fail = false;
            }

            // Respond to frontend service
            await sendItem(conn, sessionid, { corrId, fail });
            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(
            conn,
            "checkout-product",
            async (message, channel) => {
                const { corrId, checkoutId } = JSON.parse(
                    message.content.toString()
                );

                try {
                    const session = await stripe.checkout.sessions.retrieve(
                        checkoutId,
                        {
                            expand: [
                                "line_items",
                                "line_items.data.price.product",
                            ],
                        }
                    );

                    const lineItems = session.line_items.data;
                    console.log({ lineItems });

                    // extract items and quantities that were ordered
                    let productIds = [];
                    let quantities = [];
                    lineItems.forEach((item) => {
                        productIds.push(item.price.product.metadata.id);
                        quantities.push(item.quantity);
                    });
                    console.log({ productIds });
                    console.log({ quantities });

                    // Get products from db
                    const products = await Products.find({
                        _id: { $in: productIds },
                    });

                    console.log({ products });

                    let notReserved = [];
                    if (products.length < productIds.length) {
                        // Check which productIds are not found in db
                        let foundIds = products.map((product) => product.id);
                        console.log({ foundIds });

                        const missingIds = productIds.filter(
                            (id) => !foundIds.includes(id)
                        );
                        missingIds.forEach((id) => {
                            // find quantity ordered and update notReserved array
                            const qty = quantities[productIds.indexOf(id)];
                            notReserved.push({ _id: id, qty });
                        });
                    }

                    // Check if stocks are enough individually and update the product stocks
                    products.forEach(async (product) => {
                        const minusQty =
                            quantities[
                                productIds.indexOf(product._id.toString())
                            ];
                        if (product.quantity > minusQty) {
                            product.quantity -= minusQty;
                            await product.save();
                            console.log(
                                `Product ${product.name} stock has updated`
                            );
                        } else if (product.quantity === minusQty) {
                            await Products.deleteOne({ _id: product._id });
                            console.log(
                                `Product ${product.name} has been deleted as all stocks have been ordered`
                            );
                        } else {
                            // Not enough stock to reserve
                            const lackingQty = minusQty - product.quantity;
                            notReserved.push({
                                _id: product._id,
                                qty: lackingQty,
                            });
                            await Products.deleteOne({ _id: product._id });
                            console.log(
                                `Product ${product.name} has been deleted as all stocks have been ordered`
                            );
                        }
                    });

                    console.log({ notReserved });

                    await sendItem(conn, "stock-reserved", {
                        corrId,
                        orderId: session.client_reference_id,
                        notReserved,
                    });
                    channel.ack(message);
                    console.log("Dequeued message...");
                } catch (err) {
                    if (err instanceof mongoose.Error.VersionError) {
                        console.error(
                            "Concurrency conflict: Another process modified the products"
                        );
                        // Handle concurrency conflict by requeuing edit
                        channel.nack(message, false, true);
                    } else {
                        console.error(`Error Changing Product -> ${err}`);
                    }
                }
            },
            "payment"
        );
        consume(conn, "change-product", async (message, channel) => {
            try {
                let { corrId, sessionid, productId, qty } = JSON.parse(
                    message.content.toString()
                );
                qty = parseInt(qty);

                // Get product from db
                const product = await Products.findById(productId);

                if (product) {
                    // Change Product
                    const newqty = product.quantity + qty;
                    if (0 < newqty) {
                        // Ensure user does not add to cart more than stock amount, maxqty
                        product.quantity += qty;
                        console.log(
                            `Product ${product.name} stock has updated`
                        );
                        await product.save();
                    } else if (newqty <= 0) {
                        // Remove item
                        await Products.findByIdAndDelete(productId);
                        console.log(`Product ${product.name} has been deleted`);
                        if (newqty < 0) {
                            console.error(
                                `Tried to remove more than stock of id:${productId}, name:${product.name}. Product deleted instead`
                            );
                        }
                    }
                } else {
                    // reject and do not requeue message
                    channel.nack(message, false, false);
                    await sendItem(conn, sessionid, { corrId, fail: true });
                    console.error(`No product with ${productId} found`);
                }

                if (sessionid && corrId) {
                    // since order service can call change-product without needing response
                    // Respond to frontend service
                    await sendItem(conn, sessionid, { corrId, fail: false });
                }

                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                if (err instanceof mongoose.Error.VersionError) {
                    console.error(
                        "Concurrency conflict: Another process modified the products"
                    );
                    // Handle concurrency conflict by requeuing edit
                    channel.nack(message, false, true);
                } else {
                    if (sessionid && corrId) {
                        // Respond to frontend service
                        await sendItem(conn, sessionid, { corrId, fail: true });
                    }
                    channel.ack(message);
                    console.log("Dequeued message...");
                    console.error(`Error Changing Product -> ${err}`);
                }
            }
        });
    })
    .catch((err) => {
        console.log(`Product Service Consuming Error -> ${err}`);
    });
