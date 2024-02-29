FROM rabbitmq:management

ADD ./definitions.json /etc/rabbitmq/

ENV RABBITMQ_DEFAULT_USER=admin

ENV RABBITMQ_DEFAULT_PASS=admin

ENV RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS="-rabbitmq_management load_definitions \"/etc/rabbitmq/definitions.json\""

EXPOSE 15672 5672