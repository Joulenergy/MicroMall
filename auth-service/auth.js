"use strict";

const User = require("./user");
const mongo = require("./mongo");
const rabbitmq = require("./rabbitmq");
const bcrypt = require("bcrypt");
const { consume, sendItem, channels } = require("./useRabbit");
const cleanup = require("./cleanup");

/**
 *  Creates default admin account if admin does not exist
 *  */
async function checkAdmin() {
    const admin = await User.findOne({ type: "admin" });
    if (!admin) {
        console.log(
            "Admin account not found. Creating default admin account..."
        );
        const newUser = new User({
            email: "admin@gmail.com",
            name: "admin",
            password: await bcrypt.hash("admin", 10),
            type: "admin",
        });
        await newUser.save();
        console.log("Admin account created successfully");
    }
}

// main
checkAdmin();
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
                let type;
                if (!user) {
                    fail = true;
                } else {
                    const isEqual = await bcrypt.compare(
                        password,
                        user.password
                    );
                    if (!isEqual) {
                        fail = true;
                    } else {
                        id = user._id;
                        name = user.name;
                        type = user.type; // admin or buyer
                    }
                }
                // Respond to frontend service
                await sendItem(conn, sessionid, {
                    corrId,
                    name,
                    id,
                    type,
                    fail,
                });
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
        process.on("SIGTERM", () => {
            cleanup("auth-service", conn, channels);
        });
    })
    .catch((err) => {
        console.log(`Auth Service Consuming Error -> ${err}`);
    });
