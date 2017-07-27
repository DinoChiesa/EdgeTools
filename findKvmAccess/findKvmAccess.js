#! /usr/local/bin/node
/*jslint node:true */
// findKvmAccess.js
// ------------------------------------------------------------------
// in Apigee Edge, find all policies in all proxies that reference a KVM
//
// last saved: <2017-July-27 11:50:48>

var fs = require('fs'),
    async = require('async'),
    edgejs = require('apigee-edge-js'),
    common = edgejs.utility,
    apigeeEdge = edgejs.edge,
    sprintf = require('sprintf-js').sprintf,
    Getopt = require('node-getopt'),
    merge = require('merge'),
    version = '20170727-1150',
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

function examineOnePolicy(org, options) {
  return function(policyName, callback) {
    org.proxies.getPoliciesForRevision(merge(options, {policy:policyName}), function(e, result) {
      handleError(e);
      // return true if KVM and if the mapIdentifier is as specified
      var boolResult = (result.policyType == 'KeyValueMapOperations') &&
        ( ! opt.options.kvm || ((opt.options.kvm == result.mapIdentifier) &&
                                ( ! opt.options.scope || (opt.options.scope == result.scope))));
      callback(null, boolResult);
    });
  };
}

function getOneRevision (org, proxyName) {
  return function (revision, callback) {
    var options = {name:proxyName, revision:revision};
    org.proxies.getPoliciesForRevision(options, function(e, result){
      async.filterSeries(result, examineOnePolicy(org, options), function(err, results) {
        // results now equals an array of the KVM policies in this revision
        callback(null, results.map(function(elt){ return sprintf('apis/%s/revisions/%s/policies/%s', proxyName, revision, elt); }));
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

function analyzeOneProxy(org) {
  return function(proxyName, callback) {
    org.proxies.get({ name: proxyName }, function(e, result){
      handleError(e);
      async.mapSeries(result.revision, getOneRevision(org, proxyName), doneAllRevisions(proxyName, callback));
    });
  };
}


common.verifyCommonRequiredParameters(opt.options, getopt);

var options = {
      mgmtServer: opt.options.mgmtserver,
      org : opt.options.org,
      user: opt.options.username,
      password: opt.options.password,
      verbosity: opt.options.verbose || 0
    };

apigeeEdge.connect(options, function(e, org){
  if (e) {
    common.logWrite(JSON.stringify(e, null, 2));
    //console.log(e.stack);
    process.exit(1);
  }
  org.proxies.get({}, function(e, proxies) {
    async.mapSeries(proxies, analyzeOneProxy(org), doneAllProxies);
  });
});
