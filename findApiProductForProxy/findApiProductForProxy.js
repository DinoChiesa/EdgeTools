// findApiProductForProxy.js
// ------------------------------------------------------------------
//
// created: Mon Mar 20 09:57:02 2017
// last saved: <2017-August-14 17:02:09>

var request = require('request'),
    readlineSync = require('readline-sync'),
    Getopt = require('node-getopt'),
    version = '20170814-1702',
    netrc = require('netrc')(),
    mgmtUrl,
    getopt = new Getopt([
      ['M' , 'mgmtserver=ARG', 'the base path, including optional port, of the Edge mgmt server. Defaults to https://api.enterprise.apigee.com . '],
      ['u' , 'username=ARG', 'org user with permissions to read Edge configuration.'],
      ['p' , 'password=ARG', 'password for the org user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. In lieu of -u/-p'],
      ['o' , 'org=ARG', 'the Edge organization.'],
      ['P' , 'proxy=ARG', 'the proxy to find.'],
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
  'Edge API-Product-for-proxy finder, version: ' + version + '\n' +
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

if ( !opt.options.proxy ) {
  console.log('You must specify a proxy to find');
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

var url = joinUrlElements(gUrlBase, 'apiproducts?expand=true');

edgeGet(url, function(e, result) {
  var found = null;
  if (e) {
    console.log(e.stack);
    process.exit(1);
  }

  var apiproducts = result.apiProduct;
  console.log('total count of API products for that org: %d', apiproducts.length);
  var filtered = apiproducts.filter(function(product) {
        return (product.proxies.indexOf(opt.options.proxy) >= 0);
      });

  if (filtered) {
    console.log('count of API products containing %s: %d', opt.options.proxy, filtered.length);
    if (filtered.length) {
      console.log(JSON.stringify(filtered.map( function(item) { return item.name;}), null, 2));

    }
    if ( opt.options.verbose ) {
      console.log(JSON.stringify(filtered, null, 2));
    }
  }
});
