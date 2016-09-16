'use strict'

var path = require('path');
var timekeeper = require('timekeeper');
var Robot = require('hubot/src/robot');

module.exports.TextMessage = require('hubot/src/message').TextMessage;

module.exports.runBot = function (test) {
  var robot = new Robot(null, 'mock-adapter', false, 'TestBot');
  robot.adapter.on('connected', function() {
    robot.loadFile(path.resolve('.','scripts'),'deploy.js');
    loadWait(robot, function() { test(robot.adapter); });
   }); // connected

  robot.adapter.run();
};

var loadWait = function(robot, test) {
  var f = function() {
    loadWait(robot, test);
  };
  if (robot.helpCommands().length > 0) { test(); }
  else { setTimeout(f, 100); }
};

beforeEach(timekeeper.reset);
