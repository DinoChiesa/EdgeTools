#! /usr/local/bin/node
/*jslint node:true */

// generateModel.js
// ------------------------------------------------------------------
//
// Generate an API model and optionally import it into Edge, using the
// APIs defined in existing API Product in Apigee Edge.
//
// created: Mon Apr  6 10:09:24 2015
// last saved: <2015-April-09 12:11:32>

var fs = require('fs'),
    path = require('path'),
    r = require('request'),
    async = require('async'),
    Getopt = require('node-getopt'),
    dateFormat = require('dateformat'),
    version = 'Wednesday,  8 April 2015, 16:25',
    netrc = require('netrc')(),
    conditionParser = require('./ConditionsParser.js'),
    defaultMgmtUri = 'https://api.enterprise.apigee.com',
    getopt = new Getopt([
      ['M', 'server=ARG', 'the url of the management server, not including /v1/o... defaults to https://api.enterprise.apigee.com'],
      ['u', 'username=ARG', 'Edge admin user.'],
      ['p', 'password=ARG', 'password for the Edge user.'],
      ['n', 'netrc', 'retrieve the username + password from the .netrc file. Use this in lieu of -u/-p'],
      ['o', 'org=ARG', 'the Edge organization.'],
      ['P', 'apiproduct=ARG', 'the name of the API product to generate a model for.'],
      ['m', 'apimodel=ARG', 'the name of the API model to create.'],
      ['b', 'basepath=ARG', 'the base path of the deployed proxy.'],
      ['v', 'verbose'],
      ['h', 'help']
    ]).bindHelp();


getopt.setHelp(
  "generateModel.js: generate an API model from an existing API Product in Apigee Edge.\n\n" +
  "Usage: node generateModel.js [OPTIONS]\n" +
  "\n" +
  "[[OPTIONS]]\n");


function joinUrlElements() {
  var re1 = new RegExp('^\\/|\\/$', 'g'),
      elts = Array.prototype.slice.call(arguments);
  return elts.map(function(element){return element.replace(re1,""); }).join('/');
}

function curry(f) {
  var args = slice(arguments, 1);
  return function() { return f.apply(this, args.concat(slice(arguments))); };
}

function getType(obj) {
  return Object.prototype.toString.call(obj);
}

function copyHash(obj) {
  // copy an object, looking only at hashes (do not handle arrays)
  var copy = {};
  if (null === obj) { return null;}
  if (typeof obj == "object") {
    Object.keys(obj).forEach(function(key) {
      var item = obj[key], t = getType(item);
      if (t == '[object Object]') {
        item = copyHash(obj[key]);
      }
      else if (t == '[object Array]') {
        throw new Error('copying object with an array is not supported.');
      }
      copy[key] = item;
    });
  }
  else {
    throw new Error('copying a non-hash object is not supported.');
  }
  return copy;
}


function getApiProduct(apiproduct, cb) {
  var url = joinUrlElements(gUrlBase, 'apiproducts', apiproduct),
      product;
  if (opt.options.verbose) {
    console.log('getting ' + url);
  }
  r.get(url,
              requestOptions,
              function (error, response, body) {
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  product = JSON.parse(body);
                  if (opt.options.verbose) {
                    console.log('found apiproduct ' + apiproduct);
                  }
                  cb(null, product);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  cb({error: 'bad status ' + response.statusCode });
                }
              });
}

function getApiProxiesForProduct(apiproduct, cb) {
  getApiProduct(apiproduct, function(e, product){
    if (e) {
      console.log(JSON.stringify(e));
      cb(e);
    }
    cb(null, product.proxies);
  });
}

function getApiProxy(api, cb) {
  var url = joinUrlElements(gUrlBase, 'apis', api),
      proxy;
  if (opt.options.verbose) {
    console.log('getting ' + url);
  }
  r.get(url,
              requestOptions,
              function (error, response, body) {
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  proxy = JSON.parse(body);
                  if (opt.options.verbose) {
                    console.log('found apiproxy ' + api);
                  }
                  cb(null, proxy);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  cb({error: 'bad status ' + response.statusCode });
                }
              });
}


function getApiProducts(cb) {
  var url = joinUrlElements(gUrlBase, 'apiproducts');
  if (opt.options.verbose) {
    console.log('getting ' + url);
  }
  r.get(url,
              requestOptions,
              function (error, response, body) {
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  cb(null, {response: JSON.parse(body), status:response.statusCode});
                }
                else {
                  cb(null, {response:null, status:response.statusCode});
                }
              });
}


function getApiProxyRevision(api, revision, cb) {
  var url = joinUrlElements(gUrlBase, 'apis', api, 'revisions', revision);
  if (opt.options.verbose) {
    console.log('getting ' + url);
  }
  r.get(url,
              requestOptions,
              function (error, response, body) {
                var proxyEntity;
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  proxyEntity = JSON.parse(body);
                  if (opt.options.verbose) {
                    console.log('found revision %s of apiproxy %s', revision, api);
                  }
                  cb(null, proxyEntity);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  cb({error: 'bad status ' + response.statusCode });
                }
              });
}


function getApiProxyProxyEndpoint(api, revision, endpoint, cb) {
  var url = joinUrlElements(gUrlBase, 'apis', api, 'revisions', revision, 'proxies', endpoint);
  if (opt.options.verbose) {
    console.log('getting ' + url);
  }
  r.get(url,
              requestOptions,
              function (error, response, body) {
                var endpointEntity;
                if (error) {
                  console.log(error);
                  cb(error);
                }
                else if (response.statusCode == 200) {
                  endpointEntity = JSON.parse(body);
                  if (opt.options.verbose) {
                    console.log('found proxy endpoint %s for revision %s of apiproxy %s ', endpoint, revision, api);
                  }
                  cb(null, endpointEntity);
                }
                else {
                  console.log('status: ' + response.statusCode );
                  cb({error: 'bad status ' + response.statusCode });
                }
              });
}


function getProxyResourcesForProxyLatestRevision(proxyEntity, cb) {
  var revisions = proxyEntity.revision.map(function(x){return parseInt(x, 10);}),
      latestRevision =  Math.max.apply(null, revisions) +'';

  getApiProxyRevision(proxyEntity.name, latestRevision, function(e, revisionEntity){
    // curl -i -n https://api.enterprise.apigee.com/v1/o/cheeso/apis/npr-facade/revisions/1/proxies/default
    if (e) {
      console.log(JSON.stringify(e));
      cb(e);
    }
    if ( ! revisionEntity.proxyEndpoints) {
      cb({error:'cannot find proxyEndpoints', revisionEntity:revisionEntity});
    }
    if ( revisionEntity.proxyEndpoints.indexOf('default') == -1) {
      cb({error:'cannot find proxyEndpoint default', revisionEntity:revisionEntity});
    }
    console.log('proxy entity:\n' + JSON.stringify(proxyEntity,null, 2) + '\n');

    getApiProxyProxyEndpoint(proxyEntity.name, latestRevision, 'default', function(e, info){
      cb(e, {
           entity : proxyEntity,
           endpoint: info
         });
    });

  });
}


function flowIsSimpleCase(tree) {
  if (!(tree &&
    tree.operator &&
    tree.operator == 'AND' &&
    tree.operands &&
    getType(tree.operands) == '[object Array]' &&
    getType(tree.operands[0]) == '[object Object]' &&
    getType(tree.operands[1]) == '[object Object]')) {
    console.log('basic check failed');
    return false;
  }
  var foundVerb = -1, foundPath = -1, c = 1;

  tree.operands.forEach(function(expression) {
    if (((expression.operator == 'MatchesPath') ||
        (expression.operator == 'Equals')) &&
        (expression.operands[0] == 'proxy.pathsuffix')) {
      foundPath = c;
    }
    if ((expression.operator == 'Equals') &&
        (expression.operands[0] == 'request.verb')) {
      foundVerb = c;
    }
    c++;
  });

  return ((foundPath != - 1) && (foundVerb != -1))?  {pathOp:foundPath, verbOp:foundVerb}: null;
}


function importApiModel(apimodel, modelname, cb) {
  // https://{host}/v1/o/{org}/apimodels/{modelname}
  var url = joinUrlElements(gUrlBase, 'apimodels', modelname);

  function importApiModelRevision(cb) {
    var rOpts = copyHash(requestOptions);
    // https://{host}/v1/o/{org}/apimodels/{apimodel}/revisions?action=import&format=apimodel
    rOpts.url = joinUrlElements(gUrlBase, 'apimodels', modelname, 'revisions') +
      '?action=import&format=apimodel';
    rOpts.body = JSON.stringify(apimodel);
    rOpts.headers['content-type'] = 'application/json';
    console.log('importing revision...');
    console.log(JSON.stringify(apimodel, null, 2) +'\n');
    r.post(rOpts,
           function (error, response, body) {
             if (error) {
               console.log(error);
               cb(error);
             }
             else if (response.statusCode == 201) {
               body = JSON.parse(body);
               cb(null, body);
             }
             else {
               cb({
                 statusCode: response.statusCode,
                 error:'unexpected status code',
                 body: body
               });
             }
           });
  }

  function createNewApiModel(cb) {
    var rOpts = copyHash(requestOptions);
    payload = {
      name : modelname,
      displayName : modelname,
      description : "model imported from generateModel.js on " +
        dateFormat((new Date()), "dddd, mmmm dS, yyyy, h:MM:ss TT")
    };
    rOpts.headers['content-type'] = 'application/json';
    rOpts.body = JSON.stringify(payload);

    if (opt.options.verbose) {
      console.log('creating apimodel');
    }

    console.log('options:\n' + JSON.stringify(rOpts, null, 2) + '\n');
    // https://{host}/v1/o/{org}/apimodels
    rOpts.url = joinUrlElements(gUrlBase, 'apimodels' );
    r.post(rOpts,
           function (error, response, body) {
             if (error) {
               cb(error);
               return 1;
             }
             if (response.statusCode == 201) {
               body = JSON.parse(body);
               if (opt.options.verbose) {
                 console.log('created model ' + JSON.stringify(body, null, 2) + '\n');
               }
               cb(null);
             }
             else {
               console.log('status: ' + response.statusCode );
               cb({error: 'bad status ' + response.statusCode });
             }
           });
  }

  // check if model already exists.
  // if so, upload new revision.
  // if not, then create model, and upload revision
  r.get(url, requestOptions, function(e, response, body){
    if (e) {
      cb(e);
      return 1;
    }
    if (response.statusCode == 200) {
      // exists
      console.log('apimodel %s exists', modelname);
      importApiModelRevision(cb);
    }
    else {
      // does not yet exist
      console.log('apimodel %s does not yet exist', modelname);
      createNewApiModel(function(e) {
        if (e) {
          cb(e);
          return 1;
        }
        importApiModelRevision(cb);
      });
    }
  });
}


// ========================================================

console.log(
  'Edge Model generator Tool, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

// process.argv array starts with 'node' and 'scriptname.js'
var opt = getopt.parse(process.argv.slice(2));

if ( !opt.options.mgmtserver ) {
  if (opt.options.verbose) {
    console.log('using default management URI of ' + defaultMgmtUri);
  }
  opt.options.mgmtserver = defaultMgmtUri;
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
  console.log('You must provide some way to authenticate to Edge.');
  getopt.showHelp();
  process.exit(1);
}

if ( !opt.options.apimodel) {
  console.log('\nYou haven\'t specified an apimodel to create. (-m option)');
  console.log('This program will simply generate the model and save the file.\n');
}

var requestOptions = {
  headers : { accept: 'application/json' },
  auth : {
    user: opt.options.username,
    pass: opt.options.password,
    sendImmediately : true
  }};


if ( !opt.options.org ) {
  console.log('You must specify an Edge organization.');
  getopt.showHelp();
  process.exit(1);
}


if ( !opt.options.basepath ) {
  opt.options.basepath = 'http://example.com/';
}


var gUrlBase = joinUrlElements(opt.options.mgmtserver, '/v1/o/', opt.options.org);

if ( !opt.options.apiproduct ) {
  console.log('You must specify an api product.');
  getApiProducts(function(e, products){
    if (e) {
      console.log(e.stack);
     }
    console.log('available products: ' + JSON.stringify(products.response) + '\n');
    getopt.showHelp();
   });
}

else {
  getApiProxiesForProduct(opt.options.apiproduct, function(e, proxynames){
    var model = {
          displayName : opt.options.apimodel,
          description : "This model was generated on " +
        dateFormat((new Date()), "dddd, mmmm dS, yyyy, h:MM:ss TT") +
        " by generateModel.js",
          resources : []
        };
    if (e) {
      console.log(e.stack);
      process.exit(1);
    }

    console.log('proxies: ' + JSON.stringify(proxynames) + '\n');
    async.mapSeries(proxynames, getApiProxy, function(e, apiproxyEntities) {
      // this is called once ALL of the results are available.
      if (e) {
        console.log('error while retrieving proxies: ', e);
        process.exit(1);
      }
      async.mapSeries(apiproxyEntities, getProxyResourcesForProxyLatestRevision, function(e, apiproxyProxyResults) {
        console.log(JSON.stringify(apiproxyProxyResults, null, 2) + '\n');
        console.log();
        apiproxyProxyResults.forEach(function(result){
          if ( ! model.baseUrl) {
            model.baseUrl = joinUrlElements(opt.options.basepath, result.endpoint.connection.basePath);
          }
          result.endpoint.flows.forEach(function(flow){
            var tree, rsrc, s, verb, path, re1 = new RegExp("'", 'g');
            console.log('flow: %s', flow.name);
            console.log('  condition: %s', flow.condition);
            // check if simple case: verb and path
            if (flow.condition && flow.condition !== '') {
              tree = conditionParser.parse(flow.condition);
              //console.log('  tree: %s', JSON.stringify(tree, null, 2));
              s = flowIsSimpleCase(tree);
              if (s) {
                console.log('  Simple case. ');
                //console.log(JSON.stringify(result.entity));
                // add this flow to the model
                verb = tree.operands[s.verbOp - 1].operands[1].replace(re1, "");
                path = tree.operands[s.pathOp - 1].operands[1].replace(re1, "");
                rsrc = {
                  name : result.entity.name + '-' + flow.name,
                  displayName : result.entity.name + ': ' + flow.name,
                  description : '-to be provided-',
                  baseUrl : joinUrlElements(opt.options.basepath, result.endpoint.connection.basePath),
                  path : path,
                  resources : [],
                  methods : [
                    {
                      name : path.replace('/', ''),
                      displayName : path.replace('/', ''),
                      description : '-to be provided-',
                      verb: verb,
                      resourceName : result.entity.name + '-' + flow.name
                    }
                  ]
                };

                if (['POST', 'PUT'].indexOf(verb) != -1)  {
                      rsrc.methods[0].body = {
                        doc : "",
                        parameters: [],
                        sample : ""
                      };
                }

                console.log("resource: " + JSON.stringify(rsrc, null, 2) + '\n');
                model.resources.push(rsrc);
              }
              else {
                console.log('  not a simple case. This flow will need custom design.');
              }
            }
            else {
              console.log('  ignored.');
            }
          });
        });

        //console.log('generated apimodel:\n' + JSON.stringify(model, null, 2) + '\n');
        if (opt.options.apimodel) {
          // actually create it in Edge
          importApiModel(model, opt.options.apimodel, function(e, info){
            if(e) {
              console.log('error:' + JSON.stringify(e));
              return;
            }
            // TODO: emit the version number
            console.log('all done');
          });
        }
        else {
          // Save the file.
          var tmp = require('tmp');
          var tmpname = tmp.tmpNameSync({ template: './model-XXXXXX.json', keep:true, mode:0644 });
          console.log("filename: ", tmpname);
          fs.writeFileSync(tmpname, JSON.stringify(model, null, 2));
        }

      });

    });
  });

  // array of numbers
  //revisions = proxy.revision.map(function(item){return parseInt(item, 10);});
}
