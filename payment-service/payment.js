const express = require("express");
const app = express();
const { sendItem, getResponse } = require("./useRabbit");

// Configure middleware
app.use(express.json());

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);

// HOW? -> how to hold money and pay later after confirm order/delivered

// TODO: Items from cart and products
// const storeItems = new Map([
//   [1, { priceInCents: 10000, name: "Learn React Today" }],
//   [2, { priceInCents: 20000, name: "Learn CSS Today" }],
// ])

app.post("/create-checkout-session", async (req, res) => {
    try {
        // get items from payment queue

        const session = await stripe.checkout.sessions.create({
            client_reference_id: `${req.body.userId}-${Date.now()}`,
            // customer email?
            shipping_address_collection: {
              allowed_countries: ["SG"],
            },
            payment_method_types: ["card"],
            mode: "payment",
            line_items: req.body.items.map((item) => {
                const storeItem = storeItems.get(item.id);
                return {
                    price_data: {
                        currency: "sgd",
                        product_data: {
                            name: storeItem.name,
                        },
                        unit_amount: storeItem.priceInCents,
                    },
                    quantity: item.quantity,
                };
            }),
            success_url: `${process.env.CLIENT_URL}/success.html`,
            cancel_url: `${process.env.CLIENT_URL}/cancel.html`,
        });
        res.redirect(session.url);
    } catch (err) {
        console.error(err);
    }
});

app.listen(8000);
