// Commands:
//   hubot deploy <environment> <sha> - do a deploy
//   hubot approvers <environment> - Show the list of users who may deploy this environment


'use strict';

var AWS = require('aws-sdk');
var fs = require('fs');
var child = require('child_process');
var AUTODEPLOY_ENVIRONMENT = process.env.AUTODEPLOY_ENVIRONMENT;
var AUTODEPLOY_CHATROOM = process.env.AUTODEPLOY_CHATROOM;
var config = require('../lib/config');
var Approval = require('../lib/approval');
var Notification = require('../lib/notification');
var Logger = require('../lib/logger');

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

function sqsConfig (config) {
  var config = {
    region: config.sqs.region
  , params: {
      QueueUrl: config.sqs.inboxQueueUrl
    , WaitTimeSeconds: 5
    }
  }

  if (process.env.SQS_ENDPOINT) {
    config.accessKeyId = 'ACCESS_KEY';
    config.secretAccessKey = 'SECRET_KEY';
    config.endpoint = new AWS.Endpoint(process.env.SQS_ENDPOINT)
  }

  return config;
}

var deployErrorSleep = 120000;
var deploySuccessSleep = 10000;

function deployAutomaticallyToStaging(sqs, config, log) {
  function loop () {
    deployAutomaticallyToStaging(sqs, config, log);
  }

  function success () {
    setTimeout(loop, deploySuccessSleep);
  }

  function error () {
    logger.append('Error in autodeploy loop. Waiting ' + deployErrorSleep + ' millis');
    setTimeout(loop, deployErrorSleep);
  }

  var params = { MaxNumberOfMessages: 1 };
  sqs.receiveMessage(params, function (err, data) {
    if (err) {
      log('Error receiving message from SQS: ' + err);
      error();
    } else {
      try {
        var message = data.Messages && data.Messages[0];

        if (message) {
          handleInboxQueue(JSON.parse(message.Body), config, log);
          sqs.deleteMessage({ReceiptHandle: message.ReceiptHandle}, function (err, data) {
            if (err) {
              log('error removing message: ' + err);
              error();
            } else {
              success();
            }
          });
        } else {
          success();
        }
      } catch (e) {
        log(e.message);
        error();
      }
    }
  });
}

function handleInboxQueue(body, config, sender) {
  var packageKey = body.Records[0].s3.object.key;
  var environment = config.autodeploy && config.autodeploy.environment;

  if (environment) {
    var logger = new Logger({
        environment: environment
      , sha: packageKey
      , roomSender: sender
    })
    sender('Autodeploy triggered.');
    //deployPackage(environment, packageKey, logger, config);
    deployAppPackage(environment, packageKey, logger, config)
    console.log("auto deploy");
  } else {
    sender('AUTODEPLOY_ENVIRONMENT is not set. Not autodeploying ' + packageKey);
  }
}

function startAutoDeploy(config, log) {
  deployAutomaticallyToStaging(new AWS.SQS(sqsConfig(config)), config, log);
}

function deploySha (environment, sha, logger, config) {
  var packageKey = 'Track2/' + sha + '.tbz';
  deployPackage(environment, packageKey, logger, config);
}

function deployPackage(environment, packageKey, logger, config) {
  logger.open(function() {
    logger.append('Deploying '+ packageKey + ' to ' + environment);
    var s3 = new AWS.S3(s3Config());

    var params = {
      Key: packageKey
    , Bucket: 'veretech-deploybot-inbox'
    }

    var fileName = '/tmp/' + packageKey.replace(/\//g,'_');

    var file = fs.createWriteStream(fileName);
    var stream = s3.getObject(params).createReadStream();

    stream
      .on('error', function(d) { logger.close(d);} )
      .on('end', function () {
          var notification = new Notification({config: config});
          runDeployPackage(environment, fileName, logger);
          notification.notifyNewRelic(environment, packageKey, 'Deploybot', logger);
        })
      .pipe(file);
  });
}

function startE2e(environment,logger,sha){
  logger.open(function() {
    logger.append('Testing environment ' + environment);
 //   var s3 = new AWS.S3(s3Config());
    runE2e(environment, logger,sha);
  });
}

function runE2e(environment,logger,sha) {
  var proc = child.spawn('./bin/e2e_test.sh', [ environment,sha ]);
  proc.stdout.on('data', function(d) { logger.append(d);} );
  proc.stderr.on('data', function(d) { logger.append(d);} );
  proc.on('error', function(d) { logger.append(d); } );
  proc.on('close', function (code) {
    if (code == 0) logger.e2eclose();
    else           logger.e2eclose('Process exited with code '+ code);
  });
}

// // Reads app-config-1.*.json data
// function readContext(sha,callback){
//   var s3 = new AWS.S3(s3Config());
//   var params = {
//     Bucket : 'fvpc_ha_config',
//     Key : 'app-config-1.0.json'
//   };
//   var fileName = '/tmp/' + sha + '.json';
//   var file = fs.createWriteStream(fileName);
//   var stream = s3.getObject(params).createReadStream();
//   stream
//       .on('error', function(d) { logger.close(d);} )
//       .on('end', function () {
//         console.log("file is writen!");
//         callback();
//       })
//       .pipe(file);
//
// }


function deployAppSha (environment, sha, logger, config) {
  var packageKey = sha+'.json';
  deployAppPackage(environment, packageKey, logger, config);
}


function deployAppPackage(environment, packageKey, logger, config) {
  logger.open(function() {
    logger.append('Deploying '+ packageKey + ' to ' + environment);
    var s3 = new AWS.S3(s3Config());

    var params = {
      Key: packageKey
      , Bucket: process.env.DEPLOYBOT_INBOX
    }

    var sha =  packageKey.slice(0,-5)

    var fileName = '/tmp/' + packageKey.replace(/\//g,'_');

    var file = fs.createWriteStream(fileName);
    var stream = s3.getObject(params).createReadStream();

    stream
        .on('error', function(d) { logger.close(d);} )
        .on('end', function () {
          //var notification = new Notification({config: config});
          deployApp(environment, fileName, logger,sha);
          //console.log('deploytest');
         // notification.notifyNewRelic(environment, packageKey, 'Deploybot', logger);
        })
        .pipe(file);
  });
}



function deployApp(environment, fileName, logger,sha){
    var contents = fs.readFileSync(fileName);
    console.log(contents);
    var json = JSON.parse(contents);
    var appservice=json['application'][environment]['appservice'];
    var apptaskdefinition=json['application'][environment]['apptaskdefinition'];
    var appcluster=json['application'][environment]['appcluster'];
    var appimage=json['application'][environment]['appimage'];
    var configurl=json['application'][environment]['configurl'];
    var proc = child.spawn('./bin/deploy_app.sh', [ apptaskdefinition,appcluster,appservice,sha,appimage,configurl ]);
    proc.stdout.on('data', function(d) { logger.append(d);} );
    proc.stderr.on('data', function(d) { logger.append(d);} );
    proc.on('error', function(d) { logger.append(d); } );
    proc.on('close', function (code) {
      if (code == 0) logger.close();
      else           logger.close('Process exited with code '+ code);
    });
}



function runDeployPackage(environment, fileName, logger) {
  var proc = child.spawn('./bin/deploy_package', [ environment, fileName ]);
  proc.stdout.on('data', function(d) { logger.append(d);} );
  proc.stderr.on('data', function(d) { logger.append(d);} );
  proc.on('error', function(d) { logger.close(d);} );
  proc.on('close', function (code) {
    if (code == 0) logger.close();
    else           logger.close('Process exited with code '+ code);
  });
}

function setup (robot, config) {
  var approval = new Approval({config: config, brain: robot.brain});

  startAutoDeploy(config, function (msg) {
    robot.messageRoom(config.autodeploy.chatroom, '' + msg);
  });

  robot.respond(/deploy\s+(\S+)\s+(\S+)$/i, function(res) {
    var environment = res.match[1];
    var sha = res.match[2];
    var approver = res.message.user.name;
    var room = res.message.user.room;

    var result = approval.request(approver, environment, sha, room);
    var logger = new Logger({
        environment: environment
      , sha: sha
      , roomSender: function(s) {res.send(s);}
    })
    if (result === Approval.REQUESTED) {
      res.send('Deploy Request Acknowledged. Awaiting concur.\n' +
               'I need another approver to tell me:\n' +
               'concur ' + environment + ' ' + sha);
    } else if (result == Approval.APPROVED) {
      res.send('No concurrence required for ' + environment + ', launching deployment.');
      deploySha(environment, sha, logger, config);
    } else {
      res.send('Sorry, I can\'t let you do that: ' + result);
    }

  });

  // appdeploy salesforce dev sha
  robot.respond(/deployapp\s+(\S+)\s+(\S+)$/i, function(res) {
    //var application = res.match[1];
    var sha = res.match[1];
    var environment = res.match[2];

    var approver = res.message.user.name;
    var room = res.message.user.room;
    var result = approval.request(approver, environment, sha, room);
    var logger = new Logger({
      environment: environment
      , sha: sha
      , roomSender: function(s) {res.send(s);}
    })
    if (result === Approval.REQUESTED) {
      res.send('Deploy Request Acknowledged. Awaiting concur.\n' +
          'I need another approver to tell me:\n' +
          'concur ' + environment + ' ' + sha);
    } else if (result == Approval.APPROVED) {
      res.send('No concurrence required for ' + environment + ', launching deployment for');

      //deploySha(environment, sha, logger, config);
      deployAppSha(environment, sha, logger, config);
    } else {
      res.send('Sorry, I can\'t let you do that: ' + result);
    }

  });

  robot.respond(/e2e\s+(\S+)\s+(\S+)$/i, function (res) {
    var environment = res.match[1];
    var sha =  res.match[2];
    var logger = new Logger({
      environment: environment
      , sha: sha+"-test"
      , roomSender: function(s) {res.send(s);}
    });

    startE2e(environment,logger,sha);
  });
  

  robot.respond(/concur\s+(\S+)\s+(\S+)$/i, function (res) {
    var environment = res.match[1];
    var sha = res.match[2];
    var approver = res.message.user.name;
    var room = res.message.user.room;
    var result = approval.concur(approver, environment, sha, room);
    var logger = new Logger({
        environment: environment
      , sha: sha
      , roomSender: function(s) {res.send(s);}
    })

    if (result === Approval.APPROVED) {
      res.send('Valid concurrence received, launching deployment.');
      deployAppSha(environment, sha, logger, config);
    } else {
      res.send('Sorry, I can\'t let you do that: ' + result);
    }
  });

  robot.respond(/approvers\s+(\S+)$/i, function (res) {
    var environment = res.match[1];
    var approvers = approval.approvers(environment);
    var lines = ["Approvers for " + environment + ":"].concat(approvers);
    res.send(lines.join("\n"));
  });

  robot.respond(/newrelic tag\s+(\S+)\s+(\S+)$/i, function (res) {
    var environment = res.match[1];
    var sha = res.match[2];
    var tagger = res.message.user.name;
    notification.notifyNewRelic(environment, sha, tagger, logger);
  });

  robot.respond(/log\s+(\S+)$/i, function (res) {
    var environment = 'staging';
    var sha = 'revision123456789';
    var logger = new Logger({
        environment: environment
      , sha: sha
      , roomSender: function(s) {res.send(s);}
    })
    logger.open(function(){
      logger.append(res.match[1]);
      logger.close();
      res.send("Logged " + res.match[1]);
    });

  });

  // abuse the adapter to emit an event saying we're ready to
  // handle messages. This gives tests a hook to know when
  // they can safely send messages
  //
  robot.adapter.emit('deploy:ready');
}

module.exports = function (robot) {
  config.load(process.env.CONFIG_BUCKET,
              process.env.CONFIG_KEY,
              function (err, configData) {
    if (err) {
      robot.respond(/.*/, function (res) {
        res.send('Configuration error: ' + err);
      });

      return;
    }

    setup(robot, configData);
  });
};


