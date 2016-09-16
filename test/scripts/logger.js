'use strict';
var Logger = require('../../lib/logger');
var timekeeper = require('timekeeper');

describe('Logger', function() {
  it('creates expected S3 URL', function () { 
    makeTestLogger().logLink()
                    .should.eql('https://s3.amazonaws.com/veretech-deploybot-logs/staging/test_sha.log');
  });

  it('supports messaging to passed chat room', function() {
    var logger = makeTestLogger();
    logger.send('pants!');
    logger.send('are great, seriously!\n\n\n');
    logger.room.sentMessages.length
                            .should.eql(2);
  });

  describe('append', function()  {
    it('adds formatted message to empty log', function() {
      timekeeper.freeze(new Date("2015-07-12 15:30"));
      var logger = makeTestLogger();
      logger.append('NewContent');
      logger.content
            .should.eql(Logger.logFormat('NewContent'));
    });
    it('appends formatted message to non-empty log', function() {
      timekeeper.freeze(new Date("2015-07-19 15:30"));
      var logger = makeTestLogger();
      logger.content ='startValue';
      logger.append('NewContent');
      logger.content
            .should.eql('startValue' + Logger.logFormat('NewContent'));  
    });
  });

  describe('logFormat',function(){
    it('formats the input with timestamp and newline', function(){
      timekeeper.freeze(new Date("2015-07-12 15:30"));
      Logger.logFormat('AMAZING')
            .should.eql('Sun Jul 12 2015 15:30:00 GMT+0000 (UTC): AMAZING\n');
    });
  });

  describe('open', function() {
    it('fires the passed callback');
    it('queries S3 for the right file');
    it('starts with an empty log if no existing file found');
    it('Gets the existing contents of the log file', function() {
      // write some existing log to s3
      var logger =  makeTestLogger();
      var loggedBehaviorCalled = false;
      var mockS3 = {
        getObject: function(params, callback) {
          callback(null, { Body: "HEY THIS IS THE OLD LOG WOO"});
        }
      };

      logger.s3 = mockS3;

      // fire open
      var loggedBehavior = function() {
        loggedBehaviorCalled = true;
      }
      logger.open(loggedBehavior);

      // check that logger content is initialized to the existing log
      logger.content.should.eql('HEY THIS IS THE OLD LOG WOO\n\n\n');

      // check that our callback is fired.
      loggedBehaviorCalled.should.eql(true);

    });
  });

  describe('close', function(){
    it('sends the expected file metadata to S3', function() {
      var logger = makeTestLogger();
      var mockS3 = {
        putObject: function(params, cb) {
          params.ContentType.should.eql('text/plain');
        }
      };
      logger.s3 = mockS3;
      logger.close();
    });

    it('the log url is sent to chat room ', function() {
      var logger = makeTestLogger();
      var mockS3 = {
        putObject: function(params, cb) {
          cb(null, "data!");
          logger.room.sentMessages
                    .should.containEql('Deploy successful.'+ ' Log: '+ logger.logLink());
        }
      };
      logger.s3 = mockS3;
      logger.close();
    });
  });

});

function makeTestLogger () {
  var fakeRoom = {
      sentMessages: []
    , send: function(message) {
      this.sentMessages.push(message);
    }
  };
  
  var options = {
    roomSender: function(s) {fakeRoom.send(s);},
    environment : 'staging',
    sha : 'test_sha',
  };

  var l = new Logger(options);
  l.room = fakeRoom;
  return l;
}