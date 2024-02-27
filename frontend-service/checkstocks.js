const { sendItem, getResponse } = require("./useRabbit");
const express = require("express");

/**
 * Check stocks in cart
 * @param {express.Request} req
 * @param {Object[]} productitems
 * @param {Object} cart
 * @returns {Array}
 */
async function checkstocks(req, productitems, cart) {
    let alertmsg = "";
    let removeItems = [];

    // Check stocks
    for (const item of cart.items) {
        let correspondingProduct = productitems.find(
            (product) => product._id == item._id
        );
        console.log({ correspondingProduct });

        if (correspondingProduct) {
            if (correspondingProduct.quantity < item.quantity) {
                // qty will be a negative number
                const qty = parseInt(
                    correspondingProduct.quantity - item.quantity
                );
                console.log({ cartitems: cart.items });
                item.quantity = correspondingProduct.quantity;
                console.log({ cartitems: cart.items });

                // update alert msg
                if (!alertmsg) {
                    alertmsg = `The following items have been updated in your cart due to stock changes: ${item.name}`;
                } else {
                    alertmsg += `, ${item.name}`;
                }

                // update cart
                sendItem(req, "change-cart", {
                    id: req.session.userId,
                    name: item.name,
                    qty,
                    maxqty: correspondingProduct.quantity,
                })
                await getResponse(req.sessionID);
            }
        } else {
            // no stock in product, might have been deleted
            removeItems.push(item);

            // update alert msg
            if (!alertmsg) {
                alertmsg = `The following items have been updated in your cart due to stock changes: ${item.name}`;
            } else {
                alertmsg += `, ${item.name}`;
            }

            // update cart
            sendItem(req, "change-cart", {
                id: req.session.userId,
                name: item.name,
                qty: -item.quantity,
                maxqty: 0,
            })
            
            await getResponse(req.sessionID);
        }
    }

    for (const item in removeItems) {
        console.log({ cartitems: cart.items });
        console.log("Removing product from cart...");
        cart.items.splice(cart.items.indexOf(item), 1);
        console.log({ cartitems: cart.items });
        if (cart.items.length === 0) {
            cart.items = {};
        }
    }

    return [cart, alertmsg];
}

module.exports = checkstocks;