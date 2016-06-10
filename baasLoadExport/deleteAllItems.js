#! /usr/local/bin/node
/*jslint node:true */
// deleteAllItems.js
// ------------------------------------------------------------------
//
// Demonstrate how to iteratively delete all items in a BaaS collection.
//
// created: Mon Feb  9 11:18:18 2015
// last saved: <2016-June-10 09:39:56>

var util = require('util'),
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
      ['C' , 'collection=ARG', 'the Usergrid/BaaS collection from which to remove all items.'],
      ['u' , 'username=ARG', 'app user with permissions to create collections. (only if not using client creds!)'],
      ['p' , 'password=ARG', 'password for the app user.'],
      ['i' , 'clientid=ARG', 'clientid for the Usergrid/Baas app. (only if not using user creds!)'],
      ['s' , 'clientsecret=ARG', 'clientsecret for the clientid.'],
      ['e' ,  'endpoint=ARG', 'the BaaS endpoint (if not api.usergrid.com)'],
      ['v' , 'verbose'],
      ['V' , 'superverbose'],
      ['h' , 'help']
    ]).bindHelp();


function deleteOneEntity(entity, status) {
  // delete the entity from the DB
  entity.destroy(function(e){
    if (e){
      status.failCount++;
    }
  });
}

function allDone(e, startTime) {
  var endTime = new Date(),
      value = endTime - startTime;
  common.logWrite('finis');
  common.logWrite('duration: %s', common.elapsedToHHMMSS(value));

  if (e) {
    console.log("error:" + JSON.stringify(e, null, 2));
  }
}


// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

function main(args) {
  var collection, baasConn, opt = getopt.parse(args);
  try {
    baasConn = common.processOptions(opt);
    if (baasConn.collection) {
      console.log('using org:%s app:%s, delete all items from collection: %s\n',
                  baasConn.org, baasConn.app, baasConn.collection);
      console.log('** YOU WILL LOSE DATA.');
      if (!readlineSync.keyInYN('Are you sure? : ')) {
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
        common.ugCollectionForEach(ugClient,
                            { type:baasConn.collection, qs:{limit:pageSize} },
                            deleteOneEntity,
                            function(e) { allDone(e, startTime); });
      });
    }
    else {
      getopt.showHelp();
    }

  }
  catch (exc1) {
    console.log("Exception:" + exc1);
    console.log(exc1.stack);
  }
}

main(process.argv.slice(2));
