#! /usr/local/bin/node
/*jslint node:true */
// bulkExportApis.js
// ------------------------------------------------------------------
// "bulk export" APIs from an Edge org.
//
// last saved: <2017-July-27 10:37:56>

var fs = require('fs'),
    path = require('path'),
    edgejs = require('apigee-edge-js'),
    apigeeEdge = edgejs.edge,
    common = edgejs.utility,
    async = require('async'),
    Getopt = require('node-getopt'),
    version = '20170727-0946',
    exportDir = 'exported-' + new Date().getTime(),  // ms since epoch
    mgmtUrl,
    getopt = new Getopt(common.commonOptions.concat([
      ['L' , 'latest', 'retrieve only the latest revision of each API Proxy.'],
      ['R' , 'regex=ARG', 'retrieve only the proxies with name matching the pattern.'],
    ])).bindHelp();

function exportAllRevisions(org) {
  return function(apiAndRevisions, cb) {
    function exportOneApiProxyRevision(revision, cb) {
      org.proxies.export({name:apiAndRevisions.api, revision: revision}, function(e, result) {
        if (e) {
          common.logWrite("ERROR:\n" + JSON.stringify(e, null, 2));
          if (result) { common.logWrite(JSON.stringify(result, null, 2)); }
          //console.log(e.stack);
          return cb(e);
        }
        //common.logWrite(JSON.stringify(result, null, 2));
        var realFilename = path.join(exportDir, result.filename);
        fs.writeFileSync(realFilename, result.buffer);
        common.logWrite('exported: %s', realFilename);
        return cb(null, realFilename);
      });
    }

    function exportCb (e, exportResponse){
      if (e) {
        common.logWrite("ERROR:\n" + JSON.stringify(e, null, 2));
        return cb(e);
      }
      cb(null, exportResponse);
    }      
    
    if (opt.options.latest){
      var latest = Math.max.apply(null, apiAndRevisions.revisions);
      exportOneApiProxyRevision(latest, exportCb);
    }
    else {
      async.mapSeries(apiAndRevisions.revisions, exportOneApiProxyRevision, exportCb);
    }
  };
}


function getRevisionsPerApi(org) {
  return function(api, cb) {
    org.proxies.get({name:api}, function(e, result) {
      if (e) { return cb(e); }
      if ( ! result.revision) {
        return cb({error: "cannot parse output", output: result});
      }
      return cb(null, { api : api, revisions: result.revision } );
    });
  };
}


// ========================================================

console.log(
  'Edge Bulk API Exporter Tool, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

common.logWrite('start');

// process.argv array starts with 'node' and 'scriptname.js'
var opt = getopt.parse(process.argv.slice(2));

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

    if (opt.options.regex) {
      var re1 = new RegExp(opt.options.regex);
      proxies = proxies.filter( function(p) { return re1.test(p);});
    }

    async.mapSeries(proxies, getRevisionsPerApi(org), function(e, arrayOfApiAndRevisions) {
      // this is called after all of the results are available.
      if (e) {
        common.logWrite(JSON.stringify(e, null, 2));
        process.exit(1);
      }
      common.logWrite('now exporting to %s...', exportDir);
      fs.mkdir(exportDir, function(e) {
        // ignore errors
        async.mapSeries(arrayOfApiAndRevisions, exportAllRevisions(org), function (e, exportResponse){
          if (e) {
            common.logWrite(JSON.stringify(e, null, 2));
            process.exit(1);
          }
          common.logWrite('export directory: %s', exportDir);          
          //console.log(JSON.stringify(exportResponse, null, 2) + '\n');
        });
      });
    });
  });
});
