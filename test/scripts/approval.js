'use strict';

var Approval = require('../../lib/approval');
var timekeeper = require('timekeeper');

describe('Approval', function() {
  it('approves deployment on concur', function () {
    var approval = makeTestApproval();

    approval.request('bob', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.REQUESTED);

    approval.concur('carrie', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.APPROVED);
  });

  it('rejects request from non-approver', function () {
    var approval = makeTestApproval();

    approval.request('shelly', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.NOT_AN_APPROVER);

    approval.concur('carrie', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.NOT_REQUESTED);
  });

  it('rejects request for unknown environment', function () {
    var approval = makeTestApproval();

    approval.request('shelly', 'foobar', 'SHA123', 'stagingRoom')
            .should.eql(Approval.NOT_AN_APPROVER);
  });

  it('rejects concur from requester', function () {
    var approval = makeTestApproval();

    approval.request('bob', 'production', 'SHA123', 'prodRoom');
    approval.concur('bob', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.SELF_CONCUR_REJECTED);
  });

  it('rejects concur from non approver', function () {
    var approval = makeTestApproval();

    approval.request('bob', 'production', 'SHA123', 'prodRoom');
    approval.concur('shelly', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.NOT_AN_APPROVER);
  });

  it('rejects concur if not requested', function () {
    var approval = makeTestApproval();

    approval.concur('carrie','production','SHA123', 'prodRoom')
            .should.eql(Approval.NOT_REQUESTED);
  });

  it('rejects concur if already concurred', function () {
    var approval = makeTestApproval();

    approval.request('bob', 'production', 'SHA123', 'prodRoom');
    approval.concur('carrie','production','SHA123', 'prodRoom');
    approval.concur('carrie','production','SHA123', 'prodRoom')
            .should.eql(Approval.NOT_REQUESTED);
  });

  it('rejects concur for a different version', function () {
    var approval = makeTestApproval();

    approval.request('bob', 'production', 'SHAXYZ', 'prodRoom');
    approval.concur('carrie','production','SHA123', 'prodRoom')
            .should.eql(Approval.NOT_REQUESTED);
  });

  it('rejects deploy if environment/room mismatch', function() {
    var approval = makeTestApproval();

    approval.request('bob', 'staging', 'SHA123', 'prodRoom')
            .should.eql(Approval.ROOM_REQUEST_MISMATCH);
  });

  it('rejects concur if environment/room mismatch', function() {
    var approval = makeTestApproval();

    approval.request('bob', 'production', 'SHA123', 'prodRoom');
    approval.concur('carrie', 'production', 'SHA123', 'stagingRoom')
            .should.eql(Approval.ROOM_REQUEST_MISMATCH);
  });

  it('rejects concur if not expired', function () {
    var approval = makeTestApproval();

    timekeeper.freeze(new Date("2015-07-12 15:30"));
    approval.request('bob', 'production', 'SHA123', 'prodRoom');

    timekeeper.freeze(new Date("2015-07-12 15:45"));
    approval.concur('carrie', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.EXPIRED);
  });

  it('approves on request when environment no_concur_required is set' , function() {
    var approval = makeTestApproval();
    approval.request('bob', 'staging', 'SHA123', 'stagingRoom')
            .should.eql(Approval.APPROVED);
  });

  it('resets expiration timer if re-requested', function () {
    var approval = makeTestApproval();

    timekeeper.freeze(new Date("2015-07-12 15:30"));
    approval.request('bob', 'production', 'SHA123', 'prodRoom');

    timekeeper.freeze(new Date("2015-07-12 15:45"));
    approval.request('bob', 'production', 'SHA123', 'prodRoom');
    approval.concur('carrie', 'production', 'SHA123', 'prodRoom')
            .should.eql(Approval.APPROVED);
  });

  it('returns a list of approvers for env', function() {
    var approval = makeTestApproval();
    approval.approvers('staging')
            .should.eql(['bob', 'carrie', 'shelly']);
  });

  it('returns an empty list of approvers for unknown env', function() {
    var approval = makeTestApproval();
    approval.approvers('foo')
            .should.eql([]);
  });

}); // describe

function makeTestApproval () {
  return new Approval({
    config: {
      requestExpirationMinutes: 15
    , staging: {
        approvers: ['bob', 'carrie', 'shelly']
      , chatroom: 'stagingRoom'
      , no_concur_required: true
      }
    , production: {
        approvers: ['bob', 'carrie']
      , chatroom: "prodRoom"
      }
    }
  , brain: new FakeBrain()
  });
}


function FakeBrain () {
  this._data = {};
}

FakeBrain.prototype.set = function (key, value) {
  this._data[key] = value;
}
FakeBrain.prototype.get = function (key) {
  return this._data[key];
}

FakeBrain.prototype.remove = function (key) {
  delete this._data[key];
}
