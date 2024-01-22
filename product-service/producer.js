const express = require("express");
const app = express();
const amqp = require("amqplib");

const rabbitSettings = {
    protocol: 'amqp',
    hostname: 'host.docker.internal',
    port: 5672,
    username: 'guest',
    password: 'guest',
    vhost: '/',
    authMechanism: ['PLAIN','AMQPLAIN', 'EXTERNAL']
}

async function addtocart(){
    const queue = 'addtocart';
    const msgs = [
        {'name':'Bear', 'price':5, 'qty':2},
        {'name':'Octopus', 'price':2, 'qty':3},
        {'name':'Dino', 'price':4, 'qty':1}
    ]

    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createChannel();
        console.log('Channel created...');

        await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        // send messages
        for (let msg in msgs) {
            await channel.sendToQueue(queue, Buffer.from(JSON.stringify(msgs[msg])), {persistent: true})
            console.log(`Message sent to ${queue} queue...`)
        }

        setTimeout(() => {
            conn.close();
            process.exit(0);
        },500)

    } catch (err) {
        console.error(`Error adding to cart -> ${err}`);
    }
}

async function removefromcart(){
    const queue = 'removefromcart';
    const msgs = [
        {'name':'Bear', 'qty':1},
        {'name':'Dino', 'qty':1}
    ]

    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createChannel();
        console.log('Channel created...');

        await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        // send messages
        for (let msg in msgs) {
            await channel.sendToQueue(queue, Buffer.from(JSON.stringify(msgs[msg])), {persistent: true})
            console.log(`Message sent to ${queue} queue...`)
        }

        setTimeout(() => {
            conn.close();
            process.exit(0);
        },500)

    } catch (err) {
        console.error(`Error removing from cart -> ${err}`);
    }
}

async function checkedstocks(){
    const queue = 'checkedstocks';

    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createChannel();
        console.log('Channel created...');

        await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        // // send messages
        // for (let msg in msgs) {
        //     await channel.sendToQueue(queue, Buffer.from(JSON.stringify(msgs[msg])), {persistent: true})
        //     console.log(`Message sent to ${queue} queue...`)
        // }

        setTimeout(() => {
            conn.close();
            process.exit(0);
        },500)

    } catch (err) {
        console.error(`Error sending checked stocks -> ${err}`);
    }
}

app.get("/addtocart", (req, res) => {
    addtocart();
    res.send("Adding to Cart")
})

app.get("/removefromcart", (req, res) => {
    removefromcart();
    res.send("Removing from Cart")
})

app.get("/checkedstocks", (req, res) => {
    checkedstocks();
    res.send("Relaying Stock Amounts to Cart Service")
})

app.listen(5000, console.log("Product Service running on http://localhost:5000"));