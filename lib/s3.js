'use strict';

var AWS = require('aws-sdk');

exports.connect = function () {
  return new AWS.S3(s3Config());
}

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
