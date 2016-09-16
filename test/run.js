/* eslint-disable no-console */

require('coffee-script/register');
require('should');
var Mocha = require('mocha');
var MochaUtils = require('mocha/lib/utils');
var mocha = new Mocha();

var testPath = __dirname;

MochaUtils.lookupFiles(testPath, ['js'], true)
  .forEach(function(file) {
    mocha.addFile(file);
  });

mocha.run(function(failures) {
  console.log('%d failures', failures);

  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});

