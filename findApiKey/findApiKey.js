#! /usr/local/bin/node
/*jslint node:true */
// findApiKey.js
// ------------------------------------------------------------------
// find the developer and app name for an API key from an Edge org.
//
// last saved: <2016-March-15 12:19:59>

var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    async = require('async'),
    Getopt = require('node-getopt'),
    version = '20160315-1219',
    netrc = require('netrc')(),
    exportDir = 'exported-' + new Date().getTime(),  // ms since epoch
    mgmtUrl,
    getopt = new Getopt([
      ['M' , 'mgmtserver=ARG', 'the base path, including optional port, of the Edge mgmt server. Defaults to https://api.enterprise.apigee.com . '],
      ['u' , 'username=ARG', 'org user with permissions to read Edge configuration.'],
      ['p' , 'password=ARG', 'password for the org user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. In lieu of -u/-p'],
      ['o' , 'org=ARG', 'the Edge organization.'],
      ['k' , 'key=ARG', 'the key to find.'],
      ['v' , 'verbose'],
      ['h' , 'help']
    ]).bindHelp();

function joinUrlElements() {
  var re1 = new RegExp('^\\/|\\/$', 'g'),
      elts = Array.prototype.slice.call(arguments);
  return elts.map(function(element){return element.replace(re1,""); }).join('/');
}



function edgeGet(url, cb) {
  request.get(url,
              gRequestOptions,
              function (error, response, body) {
                var result;
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  result = JSON.parse(body);
                  cb(null, result);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  cb({error: 'bad status' + response.statusCode });
                }
              });
}


// ========================================================

console.log(
  'Edge API key finder, version: ' + version + '\n' +
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

var gRequestOptions = {
  headers : { accept: 'application/json' },
  auth : {
    user: opt.options.username,
    pass: opt.options.password,
    sendImmediately : true
  }};

var gUrlBase = joinUrlElements(opt.options.mgmtserver, '/v1/o/', opt.options.org);

var url = joinUrlElements(gUrlBase, 'apps?expand=true');

edgeGet(url, function(e, result) {
  var found = null;
  if (e) {
    console.log(e.stack);
    process.exit(1);
  }
  result.app.forEach(function(app) {
    if ( !found && app.credentials) app.credentials.forEach(function(cred){
      if ( !found && cred.consumerKey == opt.options.key) { found = {app:app, cred:cred}; }
    });
  });

  if (found) {
    url = joinUrlElements(gUrlBase, 'developers', found.app.developerId);
    edgeGet(url, function(e, result){
      console.log('key: ' + opt.options.key);
      console.log('app: ' + found.app.name + ' ' + found.app.appId);
      console.log('dev: ' + found.app.developerId + ' ' +
                  result.firstName + ' ' +
                  result.lastName + ' ' +
                  result.userName + ' ' +
                  result.email);
    });
  }
});
