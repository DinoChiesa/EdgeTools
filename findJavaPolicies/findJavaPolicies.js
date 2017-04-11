#! /usr/local/bin/node
/*jslint node:true */
// findJavaPolicies.js
// ------------------------------------------------------------------
// In Apigee Edge, find all policies in all proxies that reference a Java callout.
// Or, alternatively, find proxies in an org that include a specific JAR as a resource.
//
// This tool does not examine environment-wide or organization-wide resources.
//
// last saved: <2017-April-10 18:13:41>

var fs = require('fs'),
    async = require('async'),
    edgejs = require('apigee-edge-js'),
    common = edgejs.utility,
    apigeeEdge = edgejs.edge,
    sprintf = require('sprintf-js').sprintf,
    Getopt = require('node-getopt'),
    version = '20170410-1714',
    gRegexp,
    getopt = new Getopt(common.commonOptions.concat([
      ['J' , 'jar=ARG', 'Optional. JAR name to find. Default: search for JavaCallout policies.'],
      ['R' , 'regexp', 'Optional. Treat the -J option as a regexp. Default: perform string match.']
    ])).bindHelp();

// ========================================================

console.log(
  'Apigee Edge JavaCallout/JAR check tool, version: ' + version + '\n' +
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
      var boolResult = (result.policyType == 'JavaCallout');
      callback(null, boolResult);
    });
  };
}

function getOneRevision (proxyName) {
  return function (revision, callback) {
    var url, regexp;
    if ( opt.options.jar ) {
      url = sprintf('apis/%s/revisions/%s/resources', proxyName, revision);
      if (opt.options.regexp && !gRegexp) {
        gRegexp = new RegExp(opt.options.jar);
      }
      apigeeEdge.get(url, function(e, result){
        if (e) {
          return callback(null, null);
        }
        var jars = result && result.filter(function(item){
              var isJava = item.startsWith('java://');
              if ( ! isJava ) return false;
              var jarName = item.substring(7);
              return (gRegexp)?gRegexp.test(jarName) : (jarName == opt.options.jar);
            });
        callback(null, (jars && jars.length>0)?sprintf('apis/%s/revisions/%s', proxyName, revision):null);
      });
    }
    else {
      url = sprintf('apis/%s/revisions/%s/policies', proxyName, revision);
      apigeeEdge.get(url, function(e, result){
        if (e) {
          return callback(null, []);
        }
        async.filterSeries(result, examineOnePolicy(url), function(err, results) {
          var javaPolicies = results.map(function(elt){ return sprintf('%s/%s', url, elt); });
          callback(null, javaPolicies);
        });
      });
    }
  };
}

function doneAllRevisions(proxyName, callback) {
  return function(e, results) {
    handleError(e);
    if (opt.options.jar) {
      results = results.filter(function(r) {return r;});
      if (results && results.length > 0) {
        //results = results.map(function(r) {return parseInt(r, 10);});
        common.logWrite('proxy: '+ proxyName + ' ' + JSON.stringify(results));
      }
      callback(null, results);
    }
    else {
      // results is an array of arrays
      var flattened = [].concat.apply([], results);
      common.logWrite('proxy: '+ proxyName + ' ' + JSON.stringify(flattened));
      callback(null, flattened);
    }
  };
}

function doneAllProxies(e, results) {
  handleError(e);
  var flattened = [].concat.apply([], results);
  common.logWrite('matching Java %s: %s', (opt.options.jar)?"proxies":"policies", JSON.stringify(flattened));
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
