const express = require("express");
const session = require('express-session');
const ejs = require("ejs");
const fs = require('fs');
const path = require('path');
const rabbitmq = require("./rabbitmq");
const {upload} = require('./upload');
const app = express();

// Configure middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create session
app.use(session({
  secret: `${process.env.secret}`,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true } // secure: true is not set since run on localhost
}));
// TODO: add mongodb session store and add csurf?

async function sendItem(queue, msg) {
    // default exchange sending
    try {
        const channel = await rabbitmq.conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertQueue(queue, { durable: true });
        console.log("Queue created...");

        await channel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queue} queue...`);
                    channel.close();
                    console.log("Channel closed!");
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${queue} queue -> ${err}`);
    }
}

async function getResponse(exchangeName, routingKey, callback) {
    // uses the services' direct exchanges to get responses
    try {
        const channel = await rabbitmq.conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertExchange(exchangeName, "direct", {
            durable: true,
        });
        console.log("Exchange created...");

        const q = await channel.assertQueue("", {
            exclusive: true
        });
        console.log("Queue created...");
        console.log(`Waiting for messages from ${exchangeName} exchange...`);

        channel.bindQueue(q.queue, exchangeName, routingKey);

        channel.consume(
            q.queue,
            (message) => {
                console.log(`Received message...`);
                callback(message, channel);
            },
            { noAck: false }
        );
    } catch (err) {
        console.error(`Error receiving response from ${exchangeName} service -> ${err}`);
    }
}

app.get("/", (req, res) => {
    // product catalog page
    if (req.session.userId) { // authenticated
        // Ask product service to send data about 
        sendItem("catalog", {id:req.session.userId, all:true});
        // TODO: display different categories of items based on page

        // Get response from product service
        getResponse("product", req.session.userId, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log(msg[1].image.data);

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            res.render("catalog", { items: msg });
        });
    } else {
        res.redirect('/login');
    }
});

app.route("/login")
    .get((req, res) => {
        if (req.session.userId) {
            res.send("Logout?")
            //TODO: logout service
        } else {
            // Display login form
            res.render("login");
        }
    })
    .post((req, res) => {
        const { email, password } = req.body;

        // Send email and password to auth service
        sendItem("login", { email, password });

        // Get response from auth service
        getResponse("auth", email, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log(msg);

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("login", { fail: "Invalid Email or Password" });
            } else {
                req.session.userId = msg.id; // saves userId for session
                res.redirect("/");
            }
        });
    });

app.route("/register")
    .get((req, res) => {
        res.render("register");
    })
    .post((req, res) => {
        const { email, password, name } = req.body;

        // Send to queue create account
        sendItem("create-account", { email, password, name });

        // Get response from auth service
        getResponse("auth", email, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log(msg);

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("register", { fail: "Failed to create account" });
            } else {
                res.render("register", { msg: "Account created" });
            }
        });
    });

app.route("/createproduct")
    .get((req, res) => {
        if (req.session.userId) { // authenticated
            // TODO: admin users authentication?
            res.render("createproduct");
        } else {
            res.redirect('/login');
        }
    })
    .post(upload.single('image'), (req, res) => {
        const folderPath = 'productimages';
        let { name, qty, price } = req.body;
        name = name.replace(/\w*/g, function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        const newProduct = {
            name,
            quantity: qty,
            image: {
                data: fs.readFileSync(path.join(__dirname + `/${folderPath}/` + req.file.filename)),
                contentType: req.file.contentType
            },
            price
        };

        // Send to queue create product
        sendItem('create-product', {...newProduct, id:req.session.userId});

        // Clear productimages folder
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            if (files.length > 0) {
              for (const file of files) {
                const filePath = path.join(folderPath, file);
                fs.unlinkSync(filePath);
              }
            }
        }

        // Get response from product-service
        getResponse("product", req.session.userId, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log(msg);

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("createproduct", { fail: "Failed to create product" });
            } else {
                res.render("createproduct", { msg: "New product created" });
            }
        });
    })

app.post("/addtocart", async (req, res) => {
    const {name, price, qty} = req.body;
    await sendItem('addtocart',{id, name, price, qty}); // global id
    res.redirect('/');
})

app.post("/checkstocks", (req, res) => {
    res.send("Checking Stocks for Your Order...");
})

app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);
