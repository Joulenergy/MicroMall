"use strict";

const express = require("express");
const app = express();
const localtunnel = require("localtunnel");
const { sendItem, sendExchange, getResponse } = require("./useRabbit");
const fs = require("fs");
const rabbitmq = require("./rabbitmq");
const cleanup = require("./cleanup");

// Configure middleware
app.use(express.urlencoded({ extended: true }));
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);

let tunnel;
// Set up webhook endpoint in Stripe
async function setupWebhookEndpoint() {
    try {
        tunnel = await localtunnel({ port: 8000 });

        // Handle errors such as tunnel connection refused
        tunnel.on("error", (error) => {
            tunnel.close();
            console.error("Localtunnel error:", error);
            setupWebhookEndpoint();
        });

        tunnel.on("close", () => {
            console.log("payment-service localtunnel closed");
        });

        // Create a webhook endpoint in your Stripe account if does not exist
        const webhookEndpoint = (
            await stripe.webhookEndpoints.list({
                limit: 1,
            })
        ).data;

        let endpoint;
        if (webhookEndpoint.length === 0) {
            endpoint = await stripe.webhookEndpoints.create({
                url: `${tunnel.url}/webhook`,
                enabled_events: ["checkout.session.completed"],
            });
            console.log("Webhook endpoint created:", endpoint);
            // Write secret in env - need to rebuild image!
            fs.appendFileSync(
                "payment.env",
                `STRIPE_WEBHOOK_SECRET=${endpoint.secret}`
            );

            // since env is not loaded yet after being appended to file
            process.env.STRIPE_WEBHOOK_SECRET = endpoint.secret;
        } else {
            // assumes you only have 1 webhook endpoint in your stripe account!
            endpoint = await stripe.webhookEndpoints.update(
                webhookEndpoint[0].id,
                {
                    url: `${tunnel.url}/webhook`,
                }
            );
            console.log("Webhook endpoint updated", endpoint);
        }
    } catch (error) {
        console.error("Error setting up webhook endpoint:", error);
    }
}

setupWebhookEndpoint();

app.post("/create-checkout-session", async (req, res) => {
    try {
        const { sessionid, userId, name, email } = req.body;
        console.log(`Customer ${userId} ${name} has entered checkout`);

        // Retrieve the customer by email
        let customer = await stripe.customers.list({ email, limit: 1 });

        // If customer exists, return the customer object
        if (!(customer && customer.data && customer.data.length > 0)) {
            // Customer does not exist - Make API call to create a customer in Stripe
            console.log(
                "First time customer in stripe. Creating stripe customer..."
            );
            customer = await stripe.customers.create({
                id: userId,
                email: email,
                name: name,
            });
            console.log(`Customer created in stripe with id ${userId}`);
        } else {
            customer = customer.data[0];
            console.log(`Customer ${userId} data retrieved from stripe`);
        }

        // ask cart service for cart
        sendItem("get-cart", { sessionid: "payment", id: userId });

        let cart = await getResponse("payment", userId);
        console.log(`Cart data of ${userId} received by payment service`);

        // in case user checks out on another browser or other possibilities
        if (JSON.stringify(cart) == "{}") {
            res.redirect("http://localhost:3000");
        }

        const session = await stripe.checkout.sessions.create({
            client_reference_id: `${userId}-${Date.now()}`,
            customer: customer.id,
            metadata: { sessionid },
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
            success_url: "http://localhost:3000/success",
            cancel_url: "http://localhost:3000/cancel",
        });
        res.redirect(session.url);
    } catch (err) {
        console.error("Stripe checkout error:", err);
        res.send(
            "Something went wrong trying to checkout. Please try again later"
        );
    }
});

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
    const payload = req.body;
    const sig = req.headers["stripe-signature"];

    try {
        // Verify the event using your webhook signing secret
        const event = stripe.webhooks.constructEvent(
            payload,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log("Received Stripe event:", event.type);
        console.log({ event });

        // Handle the event
        switch (event.type) {
            case "checkout.session.completed":
                const session = event.data.object;
                // Handle checkout.session.completed event
                console.log("Checkout session completed. id:", session.id);
                sendExchange({
                    userId: session.customer,
                    checkoutId: session.id,
                });
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        // Return a response to acknowledge receipt of the event
        res.json({ received: true });
    } catch (error) {
        console.error("Error processing Stripe webhook event:", error.message);
    }
});

const server = app.listen(
    8000,
    console.log("Payment Service running on http://localhost:8000")
);

// handle graceful shutdown
let sigtermCount = 0;
process.on("SIGTERM", () => {
    if (sigtermCount === 0) {
        sigtermCount += 1;
        const channels = [
            ["response", rabbitmq.responseChannel],
            ["send", rabbitmq.sendChannel],
        ];
        cleanup("payment-service", rabbitmq.conn, channels, server);
        tunnel.close();
    }
});
