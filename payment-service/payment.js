"use strict";

const express = require("express");
const app = express();
const { sendItem, sendExchange, getResponse } = require("./useRabbit");

// Configure middleware
app.use(express.urlencoded({ extended: true }));

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);

app.post("/create-checkout-session", async (req, res) => {
    try {
        const { sessionid, userId, name, email } = req.body;

        console.log({ sessionid });
        console.log({ userId });
        console.log({ email });
        console.log({ name });

        // Retrieve the customer by email
        let customer = await stripe.customers.list({ email, limit: 1 });

        console.log({ customer });

        // If customer exists, return the customer object
        if (!(customer && customer.data && customer.data.length > 0)) {
            // Customer does not exist - Make API call to create a customer in Stripe
            console.log("First time customer. Creating stripe customer...");
            customer = await stripe.customers.create({
                id: userId,
                email: email,
                name: name,
            });
            console.log("Customer created");
        } else {
            customer = customer.data[0];
            console.log("Customer data retrieved");
        }

        console.log({ customer });

        // ask cart service for cart
        sendItem("get-cart", { sessionid: "payment", id: userId });

        let cart = await getResponse("payment", userId);
        console.log({ cart });

        // in case user checks out on another browser or other possibilities
        if (JSON.stringify(cart) == "{}") {
            res.redirect(`${process.env.CLIENT_URL}`);
        }

        const session = await stripe.checkout.sessions.create({
            client_reference_id: `${userId}-${Date.now()}`,
            customer: customer.id,
            shipping_address_collection: {
                allowed_countries: ["SG"],
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: {
                            amount: 500,
                            currency: "sgd",
                        },
                        display_name: "Standard Delivery",
                        delivery_estimate: {
                            minimum: {
                                unit: "business_day",
                                value: 5, // Minimum delivery estimate (1 business day)
                            },
                            maximum: {
                                unit: "business_day",
                                value: 7, // Maximum delivery estimate (1 business day)
                            },
                        },
                    },
                },
            ],
            payment_method_types: ["card"],
            mode: "payment",
            line_items: cart.items.map((item) => {
                return {
                    price_data: {
                        currency: "sgd",
                        product_data: {
                            name: item.name,
                            metadata: {
                                id: item._id,
                            },
                        },
                        unit_amount: parseInt(parseFloat(item.price) * 100),
                    },
                    quantity: item.quantity,
                };
            }),
            success_url: `${process.env.CLIENT_URL}/success`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
        });

        console.log({ session });
        // Send to payment exchange
        sendExchange({ userId, sessionid, checkoutId: session.id });

        res.redirect(session.url);
    } catch (err) {
        console.error(err);
    }
});

app.listen(8000);
