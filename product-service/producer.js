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

connect();

async function connect(){

    const queue = 'cart';
    const msgs = [
        {'name':'Bear', 'price':5},
        {'name':'Octopus', 'price':2},
        {'name':'Dino', 'price':4}
    ]

    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createChannel();
        console.log('Channel created...');

        const res = await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        // send messages
        for (let msg in msgs) {
            await channel.sendToQueue(queue, Buffer.from(JSON.stringify(msgs[msg])), {persistent: true})
            console.log(`Message sent to ${queue} queue...`)
        }

    } catch (err) {
        console.error(`Error -> ${err}`);
    }
}