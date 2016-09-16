FROM node:5.2.0

#install awscli
RUN apt-get update && apt-get install -y \
    curl \
    python2.7 \
    jq \
    vim \
    && rm -rf /var/lib/apt/lists/*

RUN curl -O https://bootstrap.pypa.io/get-pip.py
RUN   python get-pip.py && \
    pip install awscli


WORKDIR /dist

CMD ["./bin/hubot", "--adapter", "hipchat"]

ADD dist/package.json /dist/package.json
ADD dist/npm-shrinkwrap.json /dist/npm-shrinkwrap.json
RUN cd /dist && npm install --production

ENV HUBOT_HIPCHAT_JID 219422_2701159@chat.hipchat.com
ENV HUBOT_HIPCHAT_PASSWORD Veretech1
ENV HUBOT_HIPCHAT_ROOMS 219422_bbo_sit@conf.hipchat.com,219422_bbo_qa@conf.hipchat.com,219422_bbo_prod@conf.hipchat.com,219422_bbo_dev@conf.hipchat.com

ENV CONFIG_BUCKET veretech-deploybot-config
ENV CONFIG_KEY config-1.6.json

ADD dist /dist
