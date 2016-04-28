#! /usr/local/bin/node
/*jslint node:true */
// bulkExportApis.js
// ------------------------------------------------------------------
// "bulk export" APIs from an Edge org.
//
// last saved: <2016-April-27 18:40:30>

var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    readlineSync = require('readline-sync'),
    async = require('async'),
    Getopt = require('node-getopt'),
    version = '20160427-1840',
    netrc = require('netrc')(),
    exportDir = 'exported-' + new Date().getTime(),  // ms since epoch
    mgmtUrl,
    getopt = new Getopt([
      ['M' , 'mgmtserver=ARG', 'the base path, including optional port, of the Edge mgmt server. Defaults to https://api.enterprise.apigee.com . '],
      ['u' , 'username=ARG', 'org user with permissions to read Edge configuration.'],
      ['p' , 'password=ARG', 'password for the org user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. In lieu of -u/-p'],
      ['o' , 'org=ARG', 'the Edge organization.'],
      ['v', 'verbose'],
      ['h' , 'help']
    ]).bindHelp();

function joinUrlElements() {
  var re1 = new RegExp('^\\/|\\/$', 'g'),
      elts = Array.prototype.slice.call(arguments);
  return elts.map(function(element){return element.replace(re1,""); }).join('/');
}

function exportAllRevisions(apirev, cb) {
  var f = (function (api) {
        return function exportOneApiProxyRevision(revision, cb) {
          var url = joinUrlElements(gUrlBase, api, 'revisions', revision) + '?format=bundle',
              filename = path.join(exportDir, api + '.R' + revision + '.zip'),
              s = fs.createWriteStream(filename);

          s.on('finish', function() {
            cb(null, {api:api, revision:revision, zip:filename});
          });

          request
            .get(url, requestOptions)
            .on('response', function(response) {
              //console.log(response.statusCode);
              if (opt.options.verbose) {
                console.log('  ' + filename);
              }
              else {
                process.stdout.write('.');
              }
            })
            .on('error', function(e) {
              console.log(e);
              cb(e);
            })
            .pipe(s);
        };
      })(apirev.api);

  async.mapSeries(apirev.revisions, f, function (e, exportResponse){
    if (e) {
      console.log(e);
      process.exit(1);
    }
    if ( ! opt.options.verbose) { console.log(); }
    cb(null, exportResponse);
  });
}


function getApiRevisions(api, cb) {
  var url = joinUrlElements(gUrlBase, api, 'revisions');
  request.get(url,
              requestOptions,
              function (error, response, body) {
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  if (opt.options.verbose) {
                    console.log('%s: %s', api, body);
                  }
                  else {
                    process.stdout.write('.');
                  }
                  cb(null, {
                    api : api,
                    revisions: JSON.parse(body)
                  });
                }
                else {
                  cb({status:response.statusCode});
                }
              });
}


function getApis(cb) {
  console.log('getting ' + gUrlBase);
  request.get(gUrlBase,
              requestOptions,
              function (error, response, body) {
                var stack;
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  stack = JSON.parse(body);
                  if (opt.options.verbose) {
                    console.log('found %d apis:', stack.length);
                    console.log(JSON.stringify(stack, null, 2));
                  }
                  else {
                    console.log('found %d apis', stack.length);
                  }
                  cb(null, stack);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  cb({error: 'bad status' + response.statusCode });
                }
              });
}


// ========================================================

console.log(
  'Edge Bulk API Exporter Tool, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

// process.argv array starts with 'node' and 'scriptname.js'
var opt = getopt.parse(process.argv.slice(2));

if ( !opt.options.mgmtserver ) {
  opt.options.mgmtserver = 'https://api.enterprise.apigee.com';
}

if (opt.options.netrc) {
  mgmtUrl = require('url').parse(opt.options.mgmtserver);
  if ( ! netrc[mgmtUrl.hostname]) {
    console.log('The specified host ('+ mgmtUrl.hostname +') is not present in the .netrc file.');
    getopt.showHelp();
    process.exit(1);
  }

  opt.options.username = netrc[mgmtUrl.hostname].login;
  opt.options.password = netrc[mgmtUrl.hostname].password;
}

if ( !opt.options.username) {
  opt.options.username = readlineSync.question(' USER NAME  : ');
}

if ( !opt.options.password) {
  opt.options.password = readlineSync.question(' Password for '+opt.options.username + ' : ',
                                                    {hideEchoBack: true});
}


if ( !opt.options.username || !opt.options.password) {
  console.log('You must provide some way to authenticate to the Edge Management API');
  getopt.showHelp();
  process.exit(1);
}

if ( !opt.options.org ) {
  console.log('You must specify an Edge organization');
  getopt.showHelp();
  process.exit(1);
}

var requestOptions = {
  headers : { accept: 'application/json' },
  auth : {
    user: opt.options.username,
    pass: opt.options.password,
    sendImmediately : true
  }};

var gUrlBase = joinUrlElements(opt.options.mgmtserver, '/v1/o/', opt.options.org, 'apis');

getApis(function(e, results) {
  if (e) {
    console.log(e.stack);
    process.exit(1);
  }

  async.mapSeries(results, getApiRevisions, function(e, apirevs) {
    // this is called once ALL of the results are available.
    if (e) {
      console.log('error while retrieving revisions: ', e);
      process.exit(1);
    }
    console.log('\nnow exporting to %s...', exportDir);
    fs.mkdir(exportDir, function(e) {
      // ignore errors
      async.mapSeries(apirevs, exportAllRevisions, function (e, exportResponse){
        if (e) {
          console.log(e);
          process.exit(1);
        }
        console.log(JSON.stringify(exportResponse, null, 2) + '\n');
      });
    });
  });
});
