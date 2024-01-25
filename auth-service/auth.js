const express = require("express");
const app = express();
const mongoose = require("mongoose");
const User = require("./user");
const ejs = require('ejs')
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

// middleware
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended:true}))

async function goToProducts(email){
    const queue = 'loginDone';

    try {
        const conn = await amqp.connect(rabbitSettings);
        console.log('Connection created...');

        const channel = await conn.createConfirmChannel();
        console.log('Channel created...');

        await channel.assertQueue(queue, {durable: true});
        console.log('Queue created...');

        // send email
        await channel.sendToQueue(queue, Buffer.from(JSON.stringify({email,})), {persistent: true},
        (err, ok) => {
            if (err !== null)
                console.warn('Message nacked!');
                    
            else
                console.log('Message acked');
                console.log(`Message sent to ${queue} queue...`)
        })
        
        setTimeout(() => {
            conn.close();
            process.exit(0);
        },500)

    } catch (err) {
        console.error(`Error sending email to product-service -> ${err}`);
    } 
}

// connect to mongodb container
mongoose.connect(`mongodb://auth-mongo:27017/users`).then(() => {
    console.log(`Auth Service DB Connected`);
    app.listen(5001, console.log("Auth Service running on http://localhost:5001"));
}).catch((err) => console.error(err))

app.route("/login")
    .get((req, res) => {
        res.render("login")
    })
    .post(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        res.render("login", {fail: "Invalid Email or Password"});
    } else {
        if (password !== user.password) {
            res.render("login", {fail: "Invalid Email or Password"});
        } else {
            //send to product queue
            await goToProducts(user._id)
            res.redirect('http://localhost:5000') // redirect to product-service page
        }
    }
});

app.route("/register")
    .get((req, res)  => {
        res.render("register");
    })
    .post(async (req, res) => {
    const { email, password, name } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.render("register", {fail: "User already exists"});
    } else {
        const newUser = new User({
            email,
            name,
            password,
        });
        newUser.save();
        return res.json(newUser);
    }
});