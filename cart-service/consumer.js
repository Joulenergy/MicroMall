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
    const service = 'Product Service'

    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createChannel();
        console.log('Channel created...');

        const res = await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        console.log(`Waiting for messages from ${service}...`);
        // consume messages
        channel.consume(queue, (message) => {
            let product = JSON.parse(message.content.toString());
            console.log(`Received product ${product.name}`);
            console.log(`Price is ${product.price}`);

            channel.ack(message) // to remove message from queue
            console.log('Dequeued message...')
            // possible to not dequeue all messages as another service may consume from it
        },{
            noAck: false // ensures even if terminate consumer as it is processing, no task is lost, and is redelivered
        });

    } catch (err) {
        console.error(`Error -> ${err}`);
    }
}