'use strict';

var request = require('request');

function Notification (options) {
  this.config = options.config;
}

Notification.prototype.notifyNewRelic = function(environment, version_sha, deploy_user, logger) {
  var relicConfig = this._newRelicEnvironment(environment);
  var apiKey = relicConfig && relicConfig['apiKey'];
  var appId  = relicConfig && relicConfig['applicationId'];

  if (apiKey && appId) {
    this._fireNewRelic(apiKey, appId, deploy_user, version_sha, logger);
  }
  else {
    logger.append("No deployment notifications sent in "+ environment);
  }
};

Notification.prototype._newRelicEnvironment = function (environment) {
  var envConfig = this.config[environment];
  return envConfig && envConfig['newRelic'] || false;
}

Notification.prototype._fireNewRelic = function(apiKey, appId, user, sha) {
  var options = {
      url: "https://api.newrelic.com/deployments.xml"
    , headers: {
          'x-api-key': apiKey
      }
    , form: { 'deployment[application_id]': appId
            , "deployment[description]": "Automated deployment"
            , "deployment[user]": user + " (via Deploybot)"
            , "deployment[revision]": sha
            }
    };

  request.post(options, function(error, response, body, logger) {
    if (!error && response.statusCode == 200) {
      logger.append("Posted deployment notification to New Relic.");
    }
  });

}

module.exports = Notification;