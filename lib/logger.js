'use strict';

//TODO make log bucket as env variable
var AWS = require('aws-sdk');
var LOG_BUCKET = process.env.LOG_BUCKET;

function s3Config () {
  if (process.env.S3_ENDPOINT) {
    return {
      s3ForcePathStyle: true
    , accessKeyId: 'ACCESS_KEY'
    , secretAccessKey: 'SECRET_KEY'
    , endpoint: new AWS.Endpoint(process.env.S3_ENDPOINT)
    }
  } else {
    return {};
  }
}

function Logger (options) {
  this.roomSender = options.roomSender;
  this.environment = options.environment;
  this.sha = options.sha;
  this.packageKey = this.environment + '/' + this.sha + '.log';
  this.s3 = new AWS.S3(s3Config());
  this.content = '';
}

Logger.prototype.open = function(loggedBehavior) {
  var logger = this;
  var getparams = {
      Key: logger.packageKey
    , Bucket: LOG_BUCKET
  };

  logger.s3.getObject(getparams, function(err, data) {
    if (data) {
      logger.content = data.Body.toString() + '\n\n\n';
    }
    loggedBehavior();
  });
}

Logger.prototype.send = function (content) {
  this.roomSender('' + content);
}

Logger.prototype.append = function (content) {
  this.content = this.content + Logger.logFormat(content);
}

Logger.logFormat= function(value){
  return new Date() + ': ' + value + '\n'
}

Logger.prototype.close = function(content) {
  var logger = this;
  var closeMessage = content || '';
  var deployStatus ='';
  

  if (!closeMessage) deployStatus = 'Deploy successful.';
   else              deployStatus = 'Deploy failed.';

  logger.append(closeMessage);

  var params = {
      Key: logger.packageKey
    , Bucket: LOG_BUCKET
    , ACL: 'public-read'
    , Body: logger.content.toString()
    , ContentType: 'text/plain'
    , StorageClass: 'REDUCED_REDUNDANCY'
  };

  logger.s3.putObject(params, function(err, data) {
    if (err) {
      logger.send(deployStatus + " Unable to write log to S3. " + err.message);
    }
    else {
      logger.send(deployStatus + ' Log: '+ logger.logLink());
    }
  });

}


//close method for e2e tests
Logger.prototype.e2eclose = function(content) {
  var logger = this;
  var closeMessage = content || '';
  var e2estatus = '';


  if (!closeMessage) e2estatus = 'e2e successful.';
  else              e2estatus = 'e2e failed.';

  logger.append(closeMessage);

  var params = {
    Key: logger.packageKey
    , Bucket: LOG_BUCKET
    , ACL: 'public-read'
    , Body: logger.content.toString()
    , ContentType: 'text/plain'
    , StorageClass: 'REDUCED_REDUNDANCY'
  };

  logger.s3.putObject(params, function (err, data) {
    if (err) {
      logger.send(e2estatus + " Unable to write log to S3. " + err.message);
    }
    else {
      logger.send(e2estatus + ' Log: ' + logger.logLink());
    }
  });
}

Logger.prototype.logLink = function() {
  return 'https://s3.amazonaws.com/'+ LOG_BUCKET + '/' +  this.packageKey;
}

module.exports = Logger;
