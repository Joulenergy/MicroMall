"use strict";

const User = require("./User");
const mongo = require("./mongo");
const rabbitmq = require("./rabbitmq");
const { consume, sendItem } = require("./useRabbit");

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
            let name;
            if (!user) {
                fail = true;
            } else {
                name = user.name;
                if (password !== user.password) {
                    fail = true;
                } else {
                    id = user._id;
                }
            }
            // Respond to frontend service
            const msg = { name, id, fail };
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
