'use strict';

var Test = require('../test_helper');
var bob = { name: 'bob', room: 'Prod' };
var carrie = { name: 'carrie', room: 'Prod' };
var cynthia = { name: 'cynthia', room: 'Prod' };

describe('deploy', function() {
  it('accepts deploy requests', function(done){
    Test.runBot(function(adapter) {
      adapter.on('deploy:ready', function () {
        adapter.receive(new Test.TextMessage(bob, 'TestBot deploy production SHA123'));
      });

      checkScript(adapter, done, [
        'Deploy Request Acknowledged. Awaiting concur.\n' +
        'I need another approver to tell me:\n' +
        'concur production SHA123'
      ]);
    });
  });

  it('rejects deploy requests', function (done) {
    Test.runBot(function(adapter) {
      adapter.on('deploy:ready', function () {
        adapter.receive(new Test.TextMessage(cynthia, 'TestBot deploy production SHA123'));
      });

      checkScript(adapter, done, [
        'Sorry, I can\'t let you do that: not_an_approver'
      ]);
    });
  });

  it('accepts approver list requests', function (done) {
    Test.runBot(function(adapter) {
      adapter.on('deploy:ready', function () {
        adapter.receive(new Test.TextMessage(bob, 'TestBot approvers production'));
      });

      checkScript(adapter, done, [
          'Approvers for production:\n'
        + 'bob\n'
        + 'carrie'
      ]);

    });
  });

  it('deploys on concur', function (done) {
    Test.runBot(function(adapter) {
      adapter.on('deploy:ready', function () {
        adapter.receive(new Test.TextMessage(bob, 'TestBot deploy production SHA123'));
        adapter.receive(new Test.TextMessage(carrie, 'TestBot concur production SHA123'));
      });

      checkScript(adapter, done, [
        'Deploy Request Acknowledged. Awaiting concur.\n' +
        'I need another approver to tell me:\n' +
        'concur production SHA123'
      , 'Valid concurrence received, launching deployment.'
      ]);
    });
  });

  it('rejects invalid concur', function (done) {
    Test.runBot(function(adapter) {
      adapter.on('deploy:ready', function () {
        adapter.receive(new Test.TextMessage(carrie, 'TestBot concur production SHA123'));
      });

      checkScript(adapter, done, [
        'Sorry, I can\'t let you do that: not_requested'
      ]);
    });
  });

}); // describe

function checkScript(adapter, done, script) {
  adapter.on('send', function(envelope, strings) {
    for (var i = 0; i < strings.length; i++) {
      strings[i].should.eql(script.shift());
    }

    if (script.length <= 0) {
      done();
    }
  }); // send
}

