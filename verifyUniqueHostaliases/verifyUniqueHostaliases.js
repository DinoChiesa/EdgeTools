#! /usr/local/bin/node
/*jslint node:true */
// verifyUniqueHostaliases.js
// ------------------------------------------------------------------
// In Apigee Edge, verify that hostaliases are unique across all vhosts in all orgs.
//
// last saved: <2017-July-27 17:36:27>

var fs = require('fs'),
    async = require('async'),
    edgejs = require('apigee-edge-js'),
    common = edgejs.utility,
    apigeeEdge = edgejs.edge,
    sprintf = require('sprintf-js').sprintf,
    Getopt = require('node-getopt'),
    merge = require('merge'),
    version = '20170727-1650',
    gRegexp,
    modifiedOptionsList = common.commonOptions.concat([ ]).filter(function(item) { return (item[0] != 'o'); });
    getopt = new Getopt(modifiedOptionsList).bindHelp();

// ========================================================

console.log(
  'Apigee Edge Hostalias check tool, version: ' + version + '\n' +
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


function performUniquenessAnalysis(results) {
  var hash = {};
  results.forEach(function(result){
    var envmap = result.results;
    Object.keys(envmap).forEach(function(envname){
      var vhostmap = envmap[envname];
      Object.keys(vhostmap).forEach(function(vhostname){
        vhostmap[vhostname].forEach(function(host){
          hash[host] = (hash[host]) ? "ERROR " + hash[host] + host :
            sprintf("o/%s/e/%s/virtualhosts/%s", result.org, envname, vhostname);
        });
      });
    });
  });
  return hash;
}

function doneAllOrgs() {
  return function(e, results) {
    handleError(e);
    console.log(JSON.stringify(results, null, 2));
    var map = performUniquenessAnalysis(results);
    console.log(JSON.stringify(map, null, 2));
  };
}

function doneAllEnvironments(orgname, callback) {
  function reshape(item) {
    var x = {};
    x[item.env] = item.results;
    return x;
  }
  return function(e, results) {
    handleError(e);
    callback(null, {org:orgname, results:results.map(reshape).reduce(merge, {})} );
  };
}

function doneAllVhosts(envname, callback) {
  function reshape(item) {
    var x = {};
    x[item.vhost] = item.hosts;
    return x;
  }
  return function(e, results) {
    handleError(e);
    // results is an array of objects
    //callback(null, {env:envname, results:results.map(function(item){ return {} })});
    callback(null, {env:envname, results:results.map(reshape).reduce(merge, {}) } );
  };
}

function analyzeOneVhost(org, envname) {
  return function (vhostname, callback) {
    org.environments.getVhosts({name:envname, vhost:vhostname}, function(e, result){
      handleError(e);
      //console.log(JSON.stringify(result));
      common.logWrite('org[%s] env[%s] vhost[%s]: %s', org.conn.org, envname, vhostname, JSON.stringify(result.hostAliases));
      callback(null, {vhost: vhostname, hosts:result.hostAliases.map(function(alias) { return alias + ':' + result.port;}) });
    });
  };
}

function analyzeOneEnvironment(org) {
  return function (envname, callback) {
    org.environments.getVhosts({name:envname}, function(e, vhosts){
      handleError(e);
      async.mapSeries(vhosts, analyzeOneVhost(org, envname), doneAllVhosts(envname, callback));
    });
  };
}

function analyzeOneOrg(orgname, callback) {
  var options = {
        mgmtServer: opt.options.mgmtserver,
        org : orgname,
        user: opt.options.username,
        password: opt.options.password,
        verbosity: opt.options.verbose || 0
      };

  apigeeEdge.connect(options, function(e, org) {
    if (e) {
      common.logWrite(JSON.stringify(e, null, 2));
      //console.log(e.stack);
      process.exit(1);
    }

    org.environments.get({}, function(e, environments) {
      async.mapSeries(environments, analyzeOneEnvironment(org), doneAllEnvironments(org.conn.org, callback)); 
    });

  });
}


//common.verifyCommonRequiredParameters(opt.options, getopt);

async.mapSeries(opt.argv, analyzeOneOrg, doneAllOrgs()); 

