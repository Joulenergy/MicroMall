"use strict";

const User = require("./User");
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
            try {
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
                const msg = { name, id, fail };
                await sendItem(conn, sessionid, msg);
                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                console.error(`Error Logging In -> ${err}`);
            }
        });
        consume(conn, "create-account", async (message, channel) => {
            try {
                const { sessionid, name, email, password } = JSON.parse(
                    message.content.toString()
                );
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
                    });
                    newUser.save();
                    fail = false;
                }
    
                // Respond to frontend service
                const msg = { fail };
                await sendItem(conn, sessionid, msg);
                channel.ack(message);
                console.log("Dequeued message...");
            } catch (err) {
                console.error(`Error Creating Account -> ${err}`);
            }
        });
    })
    .catch((err) => {
        console.log(`Auth Service Consuming Error -> ${err}`);
    });
