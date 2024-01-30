const express = require("express");
// const session = require('express-session');
const app = express();
const ejs = require("ejs");
const rabbitmq = require("./rabbitmq");

// Configure middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// // Create session
// app.use(session({
//   secret: `${process.env.secret}`,
//   resave: false,
//   saveUninitialized: false,
//   cookie: { secure: true, httpOnly: true }
// }));

// // TODO: add mongodb session store?

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

async function authResponse(routingKey, callback) {
    try {
        const exchangeName = "login";

        const channel = await rabbitmq.conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertExchange(exchangeName, "direct", {
            durable: true,
        });
        console.log("Exchange created...");

        const q = await channel.assertQueue("", {
            exclusive: true,
            autoDelete: true,
        });
        console.log("Queue created...");
        console.log(`Waiting for messages from auth service...`);

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
        console.error(`Error receiving response from auth service -> ${err}`);
    }
}

app.get("/", (req, res) => {
    // product catalog page
    // TODO: get products from product service
    res.render("catalog", { items: products });
});

app.route("/login")
    .get((req, res) => {
        res.render("login");
    })
    .post(async (req, res) => {
        const { email, password } = req.body;

        // send to auth service
        sendItem("login", { email, password });

        // Get response from auth service
        authResponse(email, (message, channel) => {
            const msg = JSON.parse(message.content.toString());
            console.log(msg);

            channel.ack(message);
            console.log("Dequeued message...");

            channel.close();
            console.log("Channel closed...");

            if (msg.fail) {
                res.render("login", { fail: "Invalid Email or Password" });
            } else {
                res.redirect("/");
            }
        });
    });

app.route("/register")
    .get((req, res) => {
        res.render("register");
    })
    .post(async (req, res) => {
        const { email, password, name } = req.body;

        // Send to queue create account
        sendItem("create-account", { email, password, name });

        // Get response from auth service
        authResponse(email, (message, channel) => {
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

// // Login route
// app.post('/login', (req, res) => {
//   // Authenticate user
//   const user = authenticateUser(req.body.username, req.body.password);

//   if (user) {
//     // Create session cookie
//     req.session.userId = user.id;

//     // Send response
//     res.json({ success: true });
//   } else {
//     // Send error response
//     res.status(401).json({ error: 'Invalid username or password' });
//   }
// });

// // Protected route
// app.get('/protected', (req, res) => {
//   if (req.session.userId) {
//     // User is authenticated
//     res.json({ message: 'Hello, authenticated user!' });
//   } else {
//     // User is not authenticated
//     res.status(401).json({ error: 'Unauthorized' });
//   }
// });

app.listen(
    3000,
    console.log("Frontend Service running on http://localhost:3000")
);
