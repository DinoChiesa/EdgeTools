#! /usr/local/bin/node
/*jslint node:true */
// exportAllItems.js
// ------------------------------------------------------------------
//
// Demonstrate how to iteratively export all items in a BaaS collection.
//
// created: Mon Feb  9 11:18:18 2015
// last saved: <2016-December-23 11:56:04>

var fs = require('fs'),
    util = require('util'),
    Getopt = require('node-getopt'),
    usergrid = require('usergrid'),
    readlineSync = require('readline-sync'),
    common = require('./lib/common.js'),
    pageSize = 120,
    ugClient,
    getopt = new Getopt([
      ['c' , 'config=ARG', 'the configuration json file, which contains Usergrid/Baas org, app, and credentials'],
      ['o' , 'org=ARG', 'the Usergrid/BaaS organization.'],
      ['a' , 'app=ARG', 'the Usergrid/BaaS application.'],
      ['C' , 'collection=ARG', 'the Usergrid/BaaS collection from which to export all items.'],
      ['u' , 'username=ARG', 'app user with permissions to read the collection. (only if not using client creds!)'],
      ['p' , 'password=ARG', 'password for the app user.'],
      ['i' , 'clientid=ARG', 'clientid for the Usergrid/Baas app. (only if not using user creds!)'],
      ['s' , 'clientsecret=ARG', 'clientsecret for the clientid.'],
      ['e' , 'endpoint=ARG', 'the BaaS endpoint (if not https://apibaas-trial.apigee.net)'],
      ['f' , 'file=ARG', 'output file to hold the exported data. Should be writable.'],
      ['A' , 'anonymous', 'connect to BaaS anonymously. In lieu of user+pw or client id+secret.'],
      ['v' , 'verbose'],
      ['V' , 'superverbose'],
      ['h' , 'help']
    ]).bindHelp();

function allDone(e, status, writer, startTime) {
  var endTime = new Date(),
      value = endTime - startTime;
  if (e) {
    console.log("error:" + JSON.stringify(e, null, 2));
    return;
  }

  writer.end(']\n', null, function(e){
    if (e) {
      console.log("error:" + JSON.stringify(e, null, 2));
      return;
    }
    common.logWrite('finis');
    common.logWrite('duration: %s', common.elapsedToHHMMSS(value));
  });
}


function curry(fn) {
  // return a curried function with the left-most argument filled
  var args = Array.prototype.slice.call(arguments,1);
  return function() {
    return fn.apply(this,args.concat(Array.prototype.slice.call(arguments,0)));
  };
}

function storeOneEntity(writer, entity, status) {
  // store the entity
  //var data = JSON.stringify(entity._data, null, 2) + '\n';
  var data = JSON.stringify(entity._data);
  var ok = writer.write(data);
  // ok=false implies back pressure, the stream will buffer in memory. But
  // we ignore that here.
}


// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

function main(args) {
  var collection, baasConn, opt = getopt.parse(args);
  try {
    baasConn = common.processOptions(opt, getopt);

    if (baasConn.collection && opt.options.file) {
      console.log('using org:%s app:%s, export all items from collection: %s to file %s\n',
                  baasConn.org, baasConn.app, baasConn.collection, opt.options.file);
      if (!readlineSync.keyInYN('Continue? : ')) {
        // the user did not press Y
        console.log('abort.');
        process.exit();
      }
      common.logWrite('start');
      var startTime = new Date();
      common.usergridAuth(baasConn, function (e, ugClient) {
        if (e) {
          common.logWrite(JSON.stringify(e, null, 2) + '\n');
          process.exit(1);
        }

        var writer = fs.createWriteStream(opt.options.file);
        var entityStorer = curry(storeOneEntity, writer);

        writer.write('[', null, function(e) {
          common.ugCollectionForEach(ugClient,
                                     { type:baasConn.collection, qs:{limit:pageSize} },
                                     entityStorer,
                                     function(e, status) { allDone(e, status, writer, startTime); });
        });

      });
    }
    else {
      console.log('specify Collection and file.');
      getopt.showHelp();
    }

  }
  catch (exc1) {
    console.log("Exception:" + exc1);
    console.log(exc1.stack);
  }
}

main(process.argv.slice(2));
