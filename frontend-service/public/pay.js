let paynow = document.querySelector(".paynow");

paynow.addEventListener("submit", () => {
    fetch("/pay", { method: "POST" });
});
