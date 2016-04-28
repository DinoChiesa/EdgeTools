#! /usr/local/bin/node
/*jslint node:true */

// getAnalytics.js
// ------------------------------------------------------------------
//
// get analytics from Apigee into a CSV file suitable for use in MS-Excel.
//
// ------------------------------------------------------------------
//
// before running this script, in the local directory you will have to do this:
//
//     npm install
//

var https = require('https'),
    request = require('request'),
    readlineSync = require('readline-sync'),
    q = require('q'),
    fs = require('fs'),
    url = require('url'),
    version = '20160315-1219',
    netrc = require('netrc')(),
    Getopt = require('node-getopt'),
    sprintf = require('sprintf').sprintf,
    baseFsPath = '/tmp/apigee-analytics-' + getStamp() + '-',
    defaults = {
      mgmtserver : 'https://api.enterprise.apigee.com',
      dimension : 'apis',
      timeunit : 'hour',  // day
      query : 'sum(message_count)'
    },
    mgmtUrl,
    urlTemplate = '{mgmtserver}/v1/o/{org}/e/{env}/stats/{dimension}?select={query}&timeRange={start}~{finish}&timeUnit={timeunit}',
    getopt = new Getopt([
      ['M' , 'mgmtserver=ARG', 'the base path, including optional port, of the Edge mgmt server. Defaults to ' + defaults.mgmtserver],
      ['u' , 'username=ARG', 'org user with permissions to read Edge configuration.'],
      ['p' , 'password=ARG', 'password for the org user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. In lieu of -u/-p'],
      ['o' , 'org=ARG', 'the Edge organization.'],
      ['e' , 'env=ARG', 'the Edge environment.'],
      ['d' , 'dimension=ARG', 'apis, developers, etc. Defaults to ' + defaults.dimension],
      ['q' , 'query=ARG', 'the query to run.  Defaults to ' + defaults.query],
      ['s' , 'start=ARG', 'start date, eg "03/02/2016 00:00"'],
      ['f' , 'finish=ARG', 'finish (end) date, eg "03/12/2016 00:00"'],
      ['u' , 'unit=ARG', 'hour or day, defaults to ' + defaults.timeunit],
      ['h' , 'help']
    ]).bindHelp();

function getStamp() {
  var now = new Date(),
      year = now.getFullYear(),
      month = (now.getMonth() < 9 ? '0' : '') + (now.getMonth() + 1),
      dayOfMonth = (now.getDate() < 10 ? '0' : '') + now.getDate(),
      hour = ((now.getHours() % 12 || 12) < 10 ? '0' : '') + (now.getHours() % 12 || 12),
      minute = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes(),
      second = (now.getSeconds() < 10 ? '0' : '') + now.getSeconds();

  return year + month + dayOfMonth +
    '-' + hour + minute + second;
}


function getAnalytics(ctx) {
  var deferred = q.defer(),
      url = applyValues(urlTemplate, ctx.options),
      requestOptions = {
        headers : { accept: 'application/json' },
        auth : {
          user: ctx.options.username,
          pass: ctx.options.password,
          sendImmediately : true
        }
      };

  request.get(url,
              requestOptions,
              function (error, response, body) {
                if (error) {
                  deferred.reject(new Error(error));
                }
                else if (response.statusCode == 200) {
                  var r = JSON.parse(body);
                  if ( ! r.environments || !r.environments[0] ||
                       ! r.environments[0].dimensions) {
                    console.log('error retrieving analytics from ');
                    console.log(url);
                    console.log('payload: ' + body);
                    ctx.files = [];
                  }
                  else {
                    ctx.files = r.environments[0].dimensions.map(emitCsv);
                  }
                  deferred.resolve(ctx);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  deferred.reject(new Error({error: 'bad status' + response.statusCode }));
                }
              });
  return deferred.promise;
}


function emitCsv(dimension) {
  var path = baseFsPath + dimension.name + '.csv',
      payload = '';
  //console.log('dimension: ' + dimension.name);
  dimension.metrics.forEach(function(metric) {
    //console.log('  metric: ' + metric.name);
    metric.values.forEach(function(value){
      payload += '    ' + sprintf("%.12f", convertToVbaTime(value.timestamp)) + ',' + Math.floor(value.value) + '\n';
    });
    fs.writeFileSync(path, payload);
  });
  return path;
}

function convertToVbaTime(tm) {
  var t = tm / 1000,
      baseDate = 25569,    // DateSerial(1970, 1, 1)
      secsPerDay = 86400;

  return baseDate + (t / secsPerDay);
}

// function roundNumber(number, decimalDigits) {
//   var multiple = Math.pow(10, decimalDigits);
//   return Math.round(number * multiple) / multiple;
// }

function applyValues(template, hash) {
  var re, prop, match, value = template, v;
  //console.log('value: ' + value);
  for (prop in hash) {
    if (hash.hasOwnProperty(prop)) {
      re = new RegExp('(.*){' + prop +'}(.*)');
      match = re.exec(value);
      if (match) {
        v = (prop == 'mgmtserver') ? hash[prop] : encodeURIComponent(hash[prop]);
        value = match[1] + v + match[2];
        //console.log('value: ' + value);
      }
    }
  }
  return value;
}

function report (ctx) {
  //console.log('done');
  if (ctx.files) {
    ctx.files.forEach(function(f) {
      console.log(f);
    });
  }
  else {
    console.log('-no files-');
  }
  return ctx;
}


// ========================================================

console.log(
  'Edge Analytics exporter, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

// process.argv array starts with 'node' and 'scriptname.js'
var opt = getopt.parse(process.argv.slice(2));

// apply defaults
Object.keys(defaults).forEach(function (key){
  if ( !opt.options[key] ) {
    opt.options[key] = defaults[key];
  }
});

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

if ( !opt.options.env ) {
  console.log('You must specify an Edge environment');
  getopt.showHelp();
  process.exit(1);
}

if ( !opt.options.start ) {
  console.log('You must specify a start time');
  getopt.showHelp();
  process.exit(1);
}

if ( !opt.options.finish ) {
  console.log('You must specify a finish time');
  getopt.showHelp();
  process.exit(1);
}

var timeRe = new RegExp('[0-9][0-9]:[0-9][0-9]'),
    endsWithTime = function (s) {
        return timeRe.test(s.substr(-5));
    };
  if ( ! endsWithTime(opt.options.finish)) {
    opt.options.finish += ' 00:00';
  }
  if ( ! endsWithTime(opt.options.start)) {
    opt.options.start += ' 00:00';
  }



q({options: opt.options })
  .then(getAnalytics)
  .then(report)
  .done(function(){},
          function(e){
            console.log('unhandled error: ' + e);
            console.log(e.stack);
          });
