# MicroMall :department_store:
## About project
MicroMall is an e-commerce web application utilizing microservice architecture and asynchronous communication with RabbitMQ.

## Architecture diagram
![Diagram Legend](images/Legend.png)
![Architecture Diagram](images/MicroserviceArchitectureDiagram.png)

## Explaining the RabbitMQ code used
The backend services, cart, auth, product and order consume from various queues for seperate functions. For example, the product service catalog queue will consume messages that tell it what product information it needs to read from the database, and send a reply to the frontend response queue. These services reuse the useRabbit.js and rabbitmq.js code that is in the rabbitmq folder:
- The useRabbit file contains two functions - consume() and sendItem() - for consuming messages and sending a reply to the frontend. The consume function has a parameter for defining a fanout exchange and binding the queue with the exchange. The function can be improved to be used for different kinds of exchanges, but for this project only the fanout and default rabbitmq exchanges are used.
- The rabbitmq file contains the function connect() that returns a promise that resolves with the rabbitmq connection. The connection is retried since on docker-compose up, rabbitmq takes some time to set up. The environment variables I set in the docker-compose file, RABBITMQ_USERNAME and RABBITMQ_PASSWORD, is used here when connecting for easier monitoring of channels and connections in the rabbitmq GUI. Permissions for each user can also be configured, for example here my product user does not have the permission to access the rabbitmq GUI. For more information see the section [Configuring RabbitMQ](https://github.com/Joulenergy/MicroMall/tree/main?tab=readme-ov-file#configuring-rabbitmq)

The frontend service and payment service use different rabbitmq files from the backend services, as they require responses from other services.
- The frontend and payment services share a separate rabbitmq.js file, response-rabbitmq.js in the rabbitmq folder. This is allows them to create a response channel and send channel when connected to rabbitmq, compared to the backend services that use multiple channels depending on the number of queues they are connected to with their consume() function.
- The payment service and frontend service also have different useRabbit files.\
The frontend service sendItem() function sends messages to the backend services following the RabbitMQ RPC Pattern (see image below), generating unique correlation IDs for it to receive responses by incrementing a counter. \
On the other hand, the payment service does not send a correlation ID but uses the userId of the response of the cart service to find its corresponding message.\
Rather than the consume() function, the frontend and payment service have a getResponse() function that waits for a response with a timeout of 30 seconds and error handling for no response being received. \
Each frontend session has a seperate response queue, with the sessionID as the name. The correlation IDs of incoming messages are checked to ensure that the message received by the frontend from the response queue is the intended one and allows for rejecting of message replies to messages that the frontend is no longer waiting for due to the timeout. \
On the other hand, the payment service getResponse() function uses one 'payment' queue for replies and requeues messages with different userId from the user initiating the checkout session until it finds the corresponding cart.

![RPC Pattern Diagram](images/RPCPattern.png)

## How to use the application
### Running Dockerized :whale:
```
# clone repository
git clone https://github.com/Joulenergy/MicroMall.git

# access the main directory
cd MicroMall

# create nodetini image
docker build . -t nodetini
```
Tini is used to perform signal forwarding for proper cleanup of my containers on docker-compose down or ctrl C, forwarding the SIGTERM signal and allowing my containers to close connections to RabbitMQ, MongoDB and close my express HTTP servers gracefully. This is needed since docker only sends the SIGTERM to PID1, which does not send the signal to my node applications which use npm start -> nodemon -> node. The cleanup code can be found in cleanup.js

### Configurations Needed:
- Set up a stripe account
- Create .env file with stripe private key in Micromall directory
```
STRIPE_PRIVATE_KEY=<key>
```
- Edit the docker-compose.yml file with the correct bind mount path to the docker daemon logs depending on the operating system, for example /var/logs for linux, or %LOCALAPPDATA%\Docker\log\vm for windows WSL2. Refer to: https://docs.docker.com/config/daemon/logs/

### Other Possible Configurations:
- Change the default passwords of rabbitmq (in dockerfile currently) and grafana (in docker-compose file currently) and put them in a secure location :closed_lock_with_key: e.g. not committed .env files
- Change the session secret in frontend.env
- Add additional metric or log scraping jobs to prometheus.yml/ promtail.yml files
- Add additional datasources configurations into datasources.yml file in grafana folder
- Deploying multiple of the same container:
```
# example
services:
  myapp:
    image: awesome/webapp
    deploy:
      mode: replicated
      replicas: 6
```
- The bind mounts of the respective service folders eg. ./frontend-service:/app and /app/node_modules and the npm start with nodemon in the package.json files are for the hot reloading of the services and the ignoring of the local node_modules folder created with npm init (used for for intellisense). These should be removed for production. Note: the bind mount may create empty files for rabbitmq.js and cleanup.js in the folder on docker-compose up.

Finally,
```
# build the images and run the containers
docker-compose up
```
Navigate to these pages on your browser:
```
# For Frontend
http://localhost:3000 
# login with admin@gmail.com and password admin, the default admin I have configured (edit mongodb with mongodbCompass to change admin details - auth-mongo runs on port 5001)

# For RabbitMQ GUI
http://localhost:15672
# login with admin admin, the default user I have configured (or whatever password you configure)

# For Grafana
http://localhost:3001
# login with admin admin, the default user I have configured (or whatever password you configure)

# For cAdvisor
http://localhost:8080
# to see all running continers
http://localhost:8080/docker 

# For Prometheus
http://localhost:9090
# to check scraping targets and metrics endpoints
http://localhost:9090/targets

# For Loki
http://localhost:3100/metrics 
# metrics being exposed means it is up

# For Promtail
http://localhost:9080/targets 
# to check scraping targets and log endpoints
```

### Testing the app with the frontend
1. Using the admin account, head to http://localhost/3000/createproduct route to create a product. Return to the catalog page. The product should appear
2. Add it to cart. The cart icon at the top right of the screen should update the number of items in the cart. \
Note: alerts are given when:
- More items than stock is attempted to be added to cart
- Product stock is updated, leading to the cart being updated
3. Pressing the cart icon at the top right corner will open the cart. Press the 'Check Out' button at the bottom right of the cart, which will check available stocks with the product service and display the products available for purchase, and the total price.
4. Press the 'Pay Now' button to be redirected to the stripe page.

#### Testing the stripe integration:
Example Test Cards with any CVV and expiry:
|NUMBER|DESCRIPTION|
|---|---|
|4242424242424242|  Succeeds and immediately processes the payment.|
|4000000000003220|  Requires 3D Secure 2 authentication for a successful payment.|
|4000000000009995|  Always fails with a decline code of insufficient_funds.|

[Stripe Integration Testing with Test Cards](https://docs.stripe.com/testing)

5. Since there is only one shipping option configured for this stripe checkout, it should show $5.00 shipping fee added to the total cost. If the back button on the page is clicked, the session will be closed and the user is redirected back to http://localhost:3000/cancel page.
6. If payment is completed, the user will be redirected to http://localhost:3000/success, with the OrderId. If there was an error creating an order or time lag in the asynchronous creation of the order, the OrderId may not show, only showing "Thank you for your order!"

## Configuring RabbitMQ
This project uses the default vhost '/' and has created its own seperate accounts for each microservice which allows for easier monitoring of channels and connections on the rabbitmq gui.\
To create vhost and accounts other than the default account which username and password can be configured with environment variables like in my rabbitmq folder dockerfile, create your own definitions.json file. \
Either hash passwords and configure vhost manually and add in definitions.json file, or create them through the GUI and export the definitions.json file to mount into the container. \
Edit the vhost and passwords into rabbitmq.js file in each container to use when connecting to rabbitmq and put passwords somewhere secure :closed_lock_with_key: - e.g. in a not committed .env file.

### Picture Guide to creating accounts
Note: It would be good to create a new container with the rabbitmq:management image/other rabbitmq images and use it to export the definitions as my container has my own project's accounts configured
![Add User](images/AddUser.png)
![Vhost Creation](images/VirtualHostCreation.png)
![Vhost Set Permissions](images/VhostSetPermissions.png)
![Export Definitions.json file](images/ExportDefinitionsJsonFile.png)

## Technologies used :mag_right:
- Node.js
- Express.js
- RabbitMQ :envelope:
- Docker :whale:
- Stripe :credit_card:
- MongoDB and MongoDB Compass

### Monitoring Technologies :chart_with_upwards_trend:
| Tool | Description |
| --- | --- |
| cAdvisor | A daemon that collects, aggregates, processes, and exports information about running containers |
| Prometheus | Collects metrics via HTTP pull. Stores scraped metrics as time series data and uses PromQL to query metrics |
| Promtail | Attaches labels to log streams and pushes logs to Loki |
| Grafana Loki | Collects logs via HTTP push. Designed with scalabiility in mind, it only indexes metadata of logs (labels) and compresses logs into chunks to store them. Uses LogQL to query logs |
| Grafana | Dashboarding tool to visualise logs and metrics |