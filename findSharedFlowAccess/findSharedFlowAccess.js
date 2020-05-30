#! /usr/local/bin/node
/*jslint node:true */
// findSharedFlowAccess.js
// ------------------------------------------------------------------
// in Apigee Edge, find all policies in all proxies that reference a SharedFlow
//
// last saved: <2020-May-29 16:55:21>
/* jshint esversion:9 */

var fs = require('fs'),
    async = require('async'),
    edgejs = require('apigee-edge-js'),
    common = edgejs.utility,
    apigeeEdge = edgejs.edge,
    sprintf = require('sprintf-js').sprintf,
    Getopt = require('node-getopt'),
    version = '2020-05-26:15:57:00',
    getopt = new Getopt(common.commonOptions.concat([
      ['s' , 'sharedflow=ARG', 'Optional. SharedFlow name to find.'],
      ['d' , 'deployed', 'Optional. Search only deployed proxies.'],
      ['e' , 'environment=ARG', 'Optional. Search only deployed proxies in environment, -d must be specified']
    ])).bindHelp();

// ========================================================

console.log(
  'Apigee Edge SharedFlow check tool, version: ' + version + '\n' +
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
    org.proxies.getPoliciesForRevision({...options, policy:policyName}, function(e, result) {
      //
      handleError(e);
      // return true if SharedFlow and if the sharedFlowBundle is as specified
      var boolResult = (result.policyType == 'FlowCalloutBean') &&
        ( ! opt.options.sharedflow || (opt.options.sharedflow == result.sharedFlowBundle) );
      callback(null, boolResult);
    });
  };
}

function getOneRevision (org, proxyName) {
  return function (revision, callback) {
    var options = {name:proxyName, revision:revision};
    org.proxies.getPoliciesForRevision(options, function(e, result){
      async.filterSeries(result, examineOnePolicy(org, options), function(err, results) {
        // results now equals an array of the SharedFlow policies in this revision
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
  common.logWrite('matching SharedFlow policies: ' + JSON.stringify(flattened));
}

function analyzeOneProxy(org) {
  return function(proxyName, callback) {
    org.proxies.get({ name: proxyName }, function(e, result){
      handleError(e);
      async.mapSeries(result.revision, getOneRevision(org, proxyName), doneAllRevisions(proxyName, callback));
    });
  };
}

function analyzeOneProxyRevision(org) {
  return function(proxyNameRevision, callback) {
    org.proxies.get({ name: proxyNameRevision.name, revision: proxyNameRevision.revision }, function(e, result){
      handleError(e);
      async.mapSeries(result.revision, getOneRevision(org, proxyNameRevision.name), doneAllRevisions(proxyNameRevision.name, callback));
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

  if( opt.options.deployed ) {
    org.proxies.getDeployments({}, function(e, deployments) {
      let proxies = [];
      deployments.environment.forEach( e => {
          if( !opt.options.environment || (opt.options.environment === e.name)) {
            e.aPIProxy.forEach( proxy => {
              proxy.revision.forEach( r => {
                if (proxies.findIndex( t =>  t.name === proxy.name && t.revision === r.name) == -1) {
                  proxies.push({name:proxy.name, revision:r.name});
                }
              });
            });
          }
        });
      async.mapSeries(proxies, analyzeOneProxyRevision(org), doneAllProxies);
    });
  } else {
    org.proxies.get({}, function(e, proxies) {
      async.mapSeries(proxies, analyzeOneProxy(org), doneAllProxies);
    });
  }
});
