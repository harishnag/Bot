'use strict';

function Approval (options) {
  this.config = options.config;
  this.brain = options.brain;
}

Approval.prototype.request = function (user, environment, version, room) {
  if (!this._isApprover(user, environment)) {
    return Approval.NOT_AN_APPROVER;
  }

  if (!this._isExpectedRoom(room, environment)) {
    return Approval.ROOM_REQUEST_MISMATCH;
  }

  if (this._isConcurRequired(environment)) {
    this.brain.set(this._requestKey(environment, version), {
      requestedAt: new Date()
    , requester: user
    });

    return Approval.REQUESTED;
  } else {
    return Approval.APPROVED;
  }
}

Approval.prototype.concur = function (user, environment, version, room) {
  if (!this._isApprover(user, environment)) {
    return Approval.NOT_AN_APPROVER;
  }

  if (!this._isExpectedRoom(room, environment)) {
    return Approval.ROOM_REQUEST_MISMATCH;
  }

  var key = this._requestKey(environment, version)
  var request = this.brain.get(key);

  if (!request) {
    return Approval.NOT_REQUESTED;
  } else if (request.requester == user) {
    return Approval.SELF_CONCUR_REJECTED;
  } else if (this._isRequestExpired(request)) {
    return Approval.EXPIRED;
  } else {
    this.brain.remove(key);
    return Approval.APPROVED;
  }
}

Approval.prototype.approvers = function(environment) {
  var envConfig = this.config[environment];
  return (envConfig && envConfig.approvers) || [];
}

Approval.prototype._requestKey = function (environment, version) {
  return 'approvalRequest:' + environment + ':' + version;
}

Approval.prototype._isRequestExpired = function (request) {
  var expirationMillis = this.config.requestExpirationMinutes * 60 * 1000;
  return (new Date() - request.requestedAt) >= expirationMillis;
}

Approval.prototype._isApprover = function (user, environment) {
  var envConfig = this.config[environment];
  var approvers = envConfig && envConfig.approvers;
  return approvers && approvers.indexOf(user) > -1;
}

Approval.prototype._isExpectedRoom = function (room, environment) {
  var envConfig = this.config[environment];
  var expectedRoom = envConfig && envConfig.chatroom;
  return room === expectedRoom;
}

Approval.prototype._isConcurRequired = function (environment) {
  var envConfig = this.config[environment];
  return !(envConfig && envConfig.no_concur_required);
}

Approval.REQUESTED = 'requested';
Approval.NOT_AN_APPROVER = 'not_an_approver';

Approval.APPROVED = 'approved';
Approval.EXPIRED = 'expired';
Approval.NOT_REQUESTED = 'not_requested';
Approval.SELF_CONCUR_REJECTED = 'self_concur_rejected';

Approval.ROOM_REQUEST_MISMATCH = 'room_request_mismatch'

module.exports = Approval;
