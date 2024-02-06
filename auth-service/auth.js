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

async function sendItem(conn, queueName, msg) {
    // default exchange sending
    try {
        const channel = await conn.createConfirmChannel();
        console.log("Channel created...");

        await channel.assertQueue(queueName, {
            durable: true,
            arguments: { "x-expires": 1800000 },
        });
        // deletes queue after 30 minutes if unused
        console.log("Queue created...");

        await channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(msg)),
            { persistent: true },
            (err, ok) => {
                if (err !== null) console.warn("Message nacked!");
                else {
                    console.log("Message acked");
                    console.log(`Message sent to ${queueName} queue...`);
                    channel.close();
                    console.log("Channel closed...");
                }
            }
        );
    } catch (err) {
        console.error(`Error sending to ${queueName} queue -> ${err}`);
    }
}

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Auth Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "login", async (message, channel) => {
            const { sessionid, email, password } = JSON.parse(
                message.content.toString()
            );
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
            await sendItem(conn, sessionid, msg);
            channel.ack(message);
            console.log("Dequeued message...");
        });
        consume(conn, "create-account", async (message, channel) => {
            const { sessionid, name, email, password } = JSON.parse(
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
            await sendItem(conn, sessionid, msg);
            channel.ack(message);
            console.log("Dequeued message...");
        });
    })
    .catch((err) => {
        console.log(`Auth Service Consuming Error -> ${err}`);
    });
