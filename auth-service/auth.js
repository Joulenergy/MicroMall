const User = require("./User");
const rabbitmq = require("./rabbitmq");
const mongo = require("./mongo");

async function consume(conn, queueName, callback) {
    // default exchange consuming
    try {
        const channel = await conn.createChannel();
        console.log("Channel created...");

        await channel.assertQueue(queueName, { durable: true });
        console.log("Queue created...");

        channel.prefetch(1); // not realistic setting, allows for simulating fair distribution of tasks

        console.log(`Waiting for messages from ${queueName} queue...`);

        channel.consume(
            queueName,
            (message) => {
                console.log("Received message...");
                callback(message, channel);
            },
            { noAck: false }
        );
    } catch (err) {
        console.error(`Error consuming from ${queueName} queue -> ${err}`);
    }
}

async function sendItem(conn, routingKey, msg) {
    // direct exchange sending
    const exchangeName = "auth";

    try {
        const channel = await conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertExchange(exchangeName, "direct", { durable: true });
        console.log("Exchange created...");

        channel.publish(
            exchangeName,
            routingKey,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${exchangeName} exchange...`);
                    channel.close();
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${exchangeName} exchange -> ${err}`);
    }
}

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Auth Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "login", async (message, channel) => {
            const { email, password } = JSON.parse(message.content.toString());
            const user = await User.findOne({ email });
            let fail = false;
            let id;
            if (!user) {
                fail = true;
            } else {
                if (password !== user.password) {
                    fail = true;
                } else {
                    id = user._id;
                }
            }
            // Respond to frontend service
            const msg = { id, fail };
            await sendItem(conn, email, msg);
            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "create-account", async (message, channel) => {
            const { name, email, password } = JSON.parse(
                message.content.toString()
            );
            const userExists = await User.findOne({ email });
            let fail;
            if (userExists) {
                fail = true;
            } else {
                const newUser = new User({
                    email,
                    name,
                    password,
                });
                newUser.save();
                fail = false;
            }

            // Respond to frontend service
            const msg = { fail };
            await sendItem(conn, email, msg);
            channel.ack(message);
            console.log("Dequeued message...");
        });
    })
    .catch((err) => {
        console.log(`Auth Service Consuming Error -> ${err}`);
    });
