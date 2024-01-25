const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Products = require("./products");
const amqp = require("amqplib");
const ejs = require('ejs')

// for storing image into mongodb
const fs = require('fs')
const path = require('path')
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fieldSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') {
    file.contentType = 'image/jpeg';
    cb(null, true);
    } else if (file.mimetype === 'image/png') {
    file.contentType = 'image/png';
    cb(null, true);
    } else {
    cb(new Error('Invalid file type'));
    }
}
});

const rabbitSettings = {
    protocol: 'amqp',
    hostname: 'host.docker.internal',
    port: 5672,
    username: 'guest',
    password: 'guest',
    vhost: '/',
    authMechanism: ['PLAIN','AMQPLAIN', 'EXTERNAL']
}

// middleware
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended:true}))

async function sendItem(queue, msg){
    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createConfirmChannel();
        console.log('Channel created...');

        await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        // send message
        await channel.sendToQueue(queue, Buffer.from(JSON.stringify(msg), {persistent: true}),
        console.log(`Message sent to ${queue} queue...`));
        
        setTimeout(() => {
            conn.close();
            process.exit(0);
        },500)

    } catch (err) {
        console.error(`Error sending to ${queue} queue -> ${err}`);
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

// connect to mongodb container
mongoose.connect(`mongodb://product-mongo:27017/products`).then(() => {
    console.log(`Product Service DB Connected`);
    app.listen(5000, console.log("Product Service running on http://localhost:5000"));
}).catch((err) => console.error(err))

// routes
app.get("/", async (req, res) => {
    const products = await Products.find({}).catch((err) => {
        console.error(err);
        res.status(500).send('An error occurred', err);
    });
       
    res.render('catalog', { items: products });
})

app.route("/createproduct")
    .get((req, res) => {
        res.render("createproduct");
    })
    .post(upload.single('image'), (req, res) => {
        const { name, qty, price } = req.body;
        const newProduct = new Products({
            name,
            quantity: qty,
            image: {
                data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
                contentType: req.file.contentType
            },
            price
        });
        newProduct.save();
        return res.json(newProduct);
    })

app.post("/addtocart", async (req, res) => {
    // add consume email here to send as well
    // figure out a way to clear the uploads folder
    const {name, price, qty} = req.body;
    await sendItem('addtocart',{name, price, qty});
    res.redirect('/')
})

app.get("/checkedstocks", (req, res) => {
    checkedstocks();
    res.send("Relaying Stock Amounts to Cart Service");
})