'use strict';

var Config = require('../../lib/config');
var Should = require('should');

describe('Config', function () {
  describe('load', function () {
    it('loads from s3', function (done) {
      Config.load('veretech-deploybot-config','config-1.0.json', function (err, config) {
        Should(err).eql(null);
        config.requestExpirationMinutes.should.eql(15);
        done();
      });
    });
  });
});
