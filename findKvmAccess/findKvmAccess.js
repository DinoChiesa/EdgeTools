#! /usr/local/bin/node
/*jslint node:true */
// findKvmAccess.js
// ------------------------------------------------------------------
// in Apigee Edge, find all policies in all proxies that reference a KVM
//
// last saved: <2017-March-27 15:03:14>

var fs = require('fs'),
    async = require('async'),
    edgejs = require('apigee-edge-js'),
    common = edgejs.utility,
    apigeeEdge = edgejs.edge,
    sprintf = require('sprintf-js').sprintf,
    Getopt = require('node-getopt'),
    version = '20170327-1252',
    getopt = new Getopt(common.commonOptions.concat([
      ['M' , 'kvm=ARG', 'Optional. KVM name to find.'],
      ['S' , 'scope=ARG', 'Optional. Scope to match. Should be one of: (organization, environment, apiproxy)']
    ])).bindHelp();

// ========================================================

console.log(
  'Apigee Edge KVM check tool, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

common.logWrite('start');

// process.argv array starts with 'node' and 'scriptname.js'
var opt = getopt.parse(process.argv.slice(2));

function handleError(e) {
    if (e) {
      console.log(e);
      console.log(e.stack);
      process.exit(1);
    }
}

function examineOnePolicy(policyUrl) {
  return function(policyName, callback) {
    apigeeEdge.get(sprintf('%s/%s', policyUrl, policyName), function(e, result) {
      handleError(e);
      // return true if KVM and if the mapIdentifier is as specified
      var boolResult = (result.policyType == 'KeyValueMapOperations') &&
        ( ! opt.options.kvm || ((opt.options.kvm == result.mapIdentifier) &&
                                ( ! opt.options.scope || (opt.options.scope == result.scope))));
      callback(null, boolResult);
    });
  };
}

function getOneRevision (proxyName) {
  return function (revision, callback) {
    var url = sprintf('apis/%s/revisions/%s/policies', proxyName, revision);
    apigeeEdge.get(url, function(e, result){
      async.filterSeries(result, examineOnePolicy(url), function(err, results) {
        // results now equals an array of the KVM policies in this revision
        callback(null, results.map(function(elt){ return sprintf('%s/%s', url, elt); }));
      });
    });
  };
}

function doneAllRevisions(proxyName, callback) {
  return function(e, results) {
    handleError(e);
    // results is an array of arrays
    var flattened = [].concat.apply([], results);
    common.logWrite('proxy: '+ proxyName + ' ' + JSON.stringify(flattened));
    callback(null, flattened);
  };
}

function doneAllProxies(e, results) {
  handleError(e);
  var flattened = [].concat.apply([], results);
  common.logWrite('matching KVM policies: ' + JSON.stringify(flattened));
}

function analyzeOneProxy(proxyName, callback) {
  apigeeEdge.getProxy({ proxy : proxyName }, function(e, result){
    handleError(e);
    async.mapSeries(result.revision, getOneRevision(proxyName), doneAllRevisions(proxyName, callback));
  });
}

common.verifyCommonRequiredParameters(opt.options, getopt);

var options = {
      mgmtServer: opt.options.mgmtserver,
      org : opt.options.org,
      user: opt.options.username,
      password: opt.options.password,
      quiet : true
    };

apigeeEdge.connect(options, function(e, result){
  if (e) {
    console.log(e);
    console.log(e.stack);
    process.exit(1);
  }
  if (result.access_token) {
    common.logWrite('connected with OAuth2 token');
  }
  else {
    common.logWrite('connected');
  }

  apigeeEdge.getProxy({}, function(e, result){
    if (e) {
      console.log(e);
      console.log(e.stack);
      process.exit(1);
    }
    async.mapSeries(result, analyzeOneProxy, doneAllProxies);
  });
});
