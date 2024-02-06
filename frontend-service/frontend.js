const express = require("express");
const session = require("express-session");
const ejs = require("ejs");
const { sendItem, getResponse, getResponsePromise } = require("./useRabbit");
const app = express();

// Configure middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public/"));

// Create session
app.use(
    session({
        secret: `${process.env.secret}`,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true }, // secure: true is not set since run on localhost
    })
);
// TODO: add mongodb session store and add csurf?

app.get("/", async (req, res) => {
    // product catalog page
    if (req.session.userId) {
        // authenticated

        // Ask product service to send data
        sendItem(req, "catalog", { all: true });
        // possible TODO: display different categories of items based on page

        // Get response from product service
        const productitems = await getResponsePromise(req.sessionID);
        console.log({ productitems })
        
        // ask cart service to send data
        sendItem(req, "get-cart", { id: req.session.userId });

        const cartitems = await getResponsePromise(req.sessionID);
        console.log({ cartitems })

        res.render("catalog", { productitems, cartitems });
        
    } else {
        res.redirect("/login");
    }
});

// Product Service router
const productRouter = require("./routes/product");
app.use("/", productRouter);

// Auth Service router
const authRouter = require("./routes/auth");
app.use("/", authRouter);

app.post("/addtocart", async (req, res) => {
    const { name, price, qty, maxqty } = req.body;
    await sendItem(req, "change-cart", {
        id: req.session.userId,
        name,
        price,
        qty,
        maxqty,
    });
    res.redirect("/");
});

app.post("/changecart", (req, res) => {
    const { name, qty, maxqty } = req.body;
    sendItem(req, "change-cart", {
        id: req.session.userId,
        name,
        qty,
        maxqty,
    });
})

app.post("/checkstocks", (req, res) => {
    res.send("Checking Stocks for Your Order...");
});

app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);
