"use strict";

let body = document.querySelector("body");
let iconCart = document.querySelector(".icon-cart");
let closeCart = document.querySelector(".close");
let listCartHTML = document.querySelector(".listCart");
let items = document.querySelectorAll(".item");
let checkout = document.querySelector(".checkOut");

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
    })
    .then((res) => {
        if (res.redirected) {
            // Handle redirection
            window.location.href = res.url;
        }
    })
}

checkout.addEventListener("click", () => {
    // Check stocks
    // Create a form element
    const form = document.createElement("form");
    form.setAttribute("method", "POST");
    form.setAttribute("action", "/checkstocks");
    // Append the form to the document body and submit it
    document.body.appendChild(form);
    form.submit();
});

// Close and open cart tab
iconCart.addEventListener("click", () => {
    body.classList.toggle("showCart");
    fetch("/cartstate", {
        method: "POST",
    });
});
closeCart.addEventListener("click", () => {
    body.classList.toggle("showCart");
    fetch("/cartstate", {
        method: "POST",
    });
});

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