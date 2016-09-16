'use strict';

var s3 = require('./s3');

module.exports.load = function (bucket, key, callback) {
  try {
    var conn = s3.connect();
    var params = { Key: key, Bucket: bucket };

    conn.getObject(params, function (err, res) {
      if (err) {
        callback(err);
      } else {
        try {
          callback(null, JSON.parse(res.Body));
        } catch (e) {
          process.nextTick(function () {
            callback(e);
          });
        }
      }
    });
  } catch (e) {
    process.nextTick(function () {
      callback(e);
    });
  }
};
