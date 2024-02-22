"use strict";

let body = document.querySelector("body");
let iconCart = document.querySelector(".icon-cart");
let closeCart = document.querySelector(".close");
let listCartHTML = document.querySelector(".listCart");
let items = document.querySelectorAll(".item");
let checkout = document.querySelector(".checkOut");
const catalogForms = document.querySelectorAll(".catalog-form");

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

    // Check stock
    const currentQuantitySpan = item.querySelector(".current-qty");
    const currentQuantity = parseInt(currentQuantitySpan.textContent);
    const newqty = currentQuantity + change;
    if (0 <= newqty && newqty <= maxqty) {
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
            .then(async (res) => {
                // Check if the response was successful
                if (!res.ok) {
                    throw new Error("Network response was not ok");
                }

                // Parse the JSON response
                const data = await res.json();

                // Check if the data contains the 'refresh' property
                if (data.refresh) {
                    window.location.reload();
                }
            })
            .catch((error) => {
                console.error("Error ->", error);
            });
    } else {
        // User is trying to add item but not enough stock
        window.alert("Not enough stock!");
    }
}

checkout.addEventListener("click", () => {
    // Check if there are items in cart
    const p = listCartHTML.querySelector(".emptycart");

    if (p) {
        window.alert("Please add items in your cart");
    } else {
        // Cart is not empty - Check stocks
        // Create a form element
        const form = document.createElement("form");
        form.setAttribute("method", "POST");
        form.setAttribute("action", "/checkstocks");
        // Append the form to the document body and submit it
        document.body.appendChild(form);
        form.submit();
    }
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

catalogForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
        // Prevent the default form submission behavior
        event.preventDefault();

        const name = form.elements.name.value;
        console.log({ name });

        let qty = 0;

        // Perform stock checks
        items.forEach((item) => {
            const itemName = item.querySelector(".name").textContent;
            if (itemName === name) {
                qty = parseInt(item.querySelector(".current-qty").textContent);
            }
        });

        console.log({ qty });
        if (qty === 0) {
            // product not in cart
            form.submit();
        } else {
            // get max quantity
            const addqty = parseInt(form.elements.qty.value);
            const maxqty = parseInt(form.elements.qty.max);

            if (qty + addqty <= maxqty) {
                form.submit();
            } else {
                let msg = "Not enough stock!";
                if (maxqty - qty > 0) {
                    msg = `\nYou can only add ${maxqty - qty} more stock`;
                }
                // prevent form submit as not enough stock
                window.alert(msg);
            }
        }
    });
});
