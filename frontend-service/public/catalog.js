"use strict";

let body = document.querySelector("body");
let iconCart = document.querySelector(".icon-cart");
let closeCart = document.querySelector(".close");
let listCartHTML = document.querySelector(".listCart");
let items = document.querySelectorAll(".item");

function updateQuantity(item, change) {
    // get name of product
    const name = item.querySelector(".name").textContent;

    // Get the value of the 'max' attribute of the product
    let maxqty;
    const products = document.querySelectorAll(".product-card");
    products.forEach((product) => {
        if (product.querySelector(".product-name").textContent == name) {
            const quantityInput = product.querySelector(".quantityInput");
            maxqty = quantityInput.getAttribute("max");
        }
    });

    // Update quantity on page
    const currentQuantitySpan = item.querySelector(".current-qty");
    const currentQuantity = parseInt(currentQuantitySpan.textContent);
    const newQuantity = Math.min(currentQuantity + change, maxqty);

    if (newQuantity == 0) {
        item.remove();
        const updatedItems = document.querySelectorAll(".item");
        if (updatedItems.length == 0) {
            const emptyCartMessage = document.createElement("p");
            emptyCartMessage.textContent = 'Cart is Empty';
            emptyCartMessage.classList.add('emptycart');
            listCartHTML.appendChild(emptyCartMessage);
        }
    } else {
        currentQuantitySpan.textContent = newQuantity;
    }

    // Update total cart items
    const cartCountSpan = document.getElementById("cartcount");
    const cartCount = parseInt(cartCountSpan.textContent);
    cartCountSpan.textContent = cartCount - currentQuantity + newQuantity;

    updatePrice(item, currentQuantity, newQuantity);

    // Send to cart service
    fetch("/changecart", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            qty: change,
            maxqty,
        }),
    });
}

function updatePrice(item, currentQuantity, newQuantity) {
    const checkoutPriceParagraph = document.querySelector(".checkoutPrice");
    const checkoutPrice = parseFloat(
        checkoutPriceParagraph.textContent.split("$")[1]
    );
    const totalPriceDiv = item.querySelector(".totalPrice");
    const totalPrice = parseFloat(totalPriceDiv.textContent.split("$")[1]);

    // Calculate new prices
    const newTotalPrice = (totalPrice / currentQuantity) * newQuantity;
    const newCheckoutPrice = checkoutPrice - totalPrice + newTotalPrice;

    // Set prices
    totalPriceDiv.textContent = "$ " + newTotalPrice.toFixed(2);
    checkoutPriceParagraph.textContent = "Total Price: $" + newCheckoutPrice.toFixed(2);
}

// Close and open cart tab
iconCart.addEventListener("click", () => {
    body.classList.toggle("showCart");
});
closeCart.addEventListener("click", () => {
    body.classList.toggle("showCart");
});

// Minus and plus buttons in cart
items.forEach((item) => {
    const minusSpan = item.querySelector(".minus");
    const plusSpan = item.querySelector(".plus");

    minusSpan.addEventListener("click", () => {
        updateQuantity(item, -1);
    });

    plusSpan.addEventListener("click", () => {
        updateQuantity(item, 1);
    });
});
