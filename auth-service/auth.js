"use strict";

const User = require("./user");
const mongo = require("./mongo");
const rabbitmq = require("./rabbitmq");
const bcrypt = require("bcrypt");
const { consume, sendItem } = require("./useRabbit");

// main
Promise.all([rabbitmq.connect(), mongo.connect()])
    .then(([conn]) => {
        console.log(`Auth Service DB Connected`);
        console.log("RabbitMQ Connected");

        consume(conn, "login", async (message, channel) => {
            const { corrId, sessionid, email, password } = JSON.parse(
                message.content.toString()
            );
            try {
                const user = await User.findOne({ email });
                let fail = false;
                let id;
                let name;
                if (!user) {
                    fail = true;
                } else {
                    name = user.name;
                    const isEqual = await bcrypt.compare(
                        password,
                        user.password
                    );
                    if (!isEqual) {
                        fail = true;
                    } else {
                        id = user._id;
                    }
                }
                // Respond to frontend service
                await sendItem(conn, sessionid, { corrId, name, id, fail });
                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                // Respond to frontend service
                await sendItem(conn, sessionid, { corrId, fail: true });
                channel.ack(message);
                console.log("Dequeued message...");
                console.error(`Error Logging In -> ${err}`);
            } 
        });
        consume(conn, "create-account", async (message, channel) => {
            const { corrId, sessionid, name, email, password } = JSON.parse(
                message.content.toString()
            );
            try {
                const userExists = await User.findOne({ email });
                let fail;
                if (userExists) {
                    fail = true; // cannot create a new account
                } else {
                    const hashedPass = await bcrypt.hash(password, 10);
                    const newUser = new User({
                        email,
                        name,
                        password: hashedPass,
                        type: "buyer",
                    });
                    await newUser.save();
                    fail = false;
                }

                // Respond to frontend service
                await sendItem(conn, sessionid, { corrId, fail });
                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                await sendItem(conn, sessionid, { corrId, fail: true });
                channel.ack(message);
                console.log("Dequeued message...");
                console.error(`Error Creating Account -> ${err}`);
            }
        });
    })
    .catch((err) => {
        console.log(`Auth Service Consuming Error -> ${err}`);
    });
