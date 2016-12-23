// common.js
// ------------------------------------------------------------------
//
// common functions used by the loader, exportAllItems, and deleteAllItems scripts.
//
// created: Mon Jun  6 17:32:20 2016
// last saved: <2016-December-23 12:26:03>

(function (globalScope){
  var util = require('util'),
      usergrid = require('usergrid'),
      fs = require('fs'),
      readlineSync = require('readline-sync');

  function logWrite() {
    var time = (new Date()).toString(),
        tstr = '[' + time.substr(11, 4) + '-' +
      time.substr(4, 3) + '-' + time.substr(8, 2) + ' ' +
      time.substr(16, 8) + '] ';
    console.log(tstr + util.format.apply(null, arguments));
  }

  function elapsedToHHMMSS (elapsed) {
    function leadingPad(n, p, c) {
      var pad_char = typeof c !== 'undefined' ? c : '0';
      var pad = new Array(1 + p).join(pad_char);
      return (pad + n).slice(-pad.length);
    }
    elapsed = (typeof(elapsed) != 'number') ? parseInt(elapsed, 10) : elapsed;
    var hours   = Math.floor(elapsed / (3600 * 1000)),
        minutes = Math.floor((elapsed - (hours * 3600 * 1000)) / (60 * 1000)),
        seconds = Math.floor((elapsed - (hours * 3600 * 1000) - (minutes * 60 * 1000)) / 1000),
        ms = elapsed - (hours * 3600 * 1000) - (minutes * 60 * 1000) - seconds * 1000;

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds + '.' + leadingPad(ms, 3);
    return time;
  }

  function usergridAuth(baasConn, fn) {
    var ugClient, ugConfig = {
          URI : baasConn.URI || 'https://apibaas-trial.apigee.net', // 'https://api.usergrid.com'
          orgName: baasConn.org,
          appName: baasConn.app,
          buildCurl: baasConn.buildCurl,
          logging: baasConn.wantLogging
        };
    if (baasConn.username && baasConn.password) {
      ugClient = new usergrid.client(ugConfig);
      ugClient.login(baasConn.username, baasConn.password,
                     function (e) {
                       if (e) {
                         fn({error:"could user login failed", baasError: e});
                       }
                       else {
                         // make a new client just for the app user, then use this
                         // client to make calls against the API.
                         ugConfig.authType = usergrid.AUTH_APP_USER;
                         ugConfig.token = ugClient.token;
                         fn(null, new usergrid.client(ugConfig));
                       }
                     });
    }
    else if (baasConn.clientid && baasConn.clientsecret) {
      ugConfig.authType = usergrid.AUTH_CLIENT_ID;
      ugConfig.clientId = baasConn.clientid;
      ugConfig.clientSecret = baasConn.clientsecret;
      fn(null, new usergrid.client(ugConfig));
    }
    else {
      ugConfig.authType = usergrid.NONE;
      fn(null, new usergrid.client(ugConfig));
      // fn({error: "missing credentials"});
    }
  }

  function processOptions(opt, getopt) {
    var baasConn;

    if (opt.options.config) {
      var moreOptions = JSON.parse(fs.readFileSync(opt.options.config, 'utf8'));
      baasConn = {};
      Object.keys(moreOptions).forEach(function(key){
        opt.options[key] = moreOptions[key];
        if (key != 'verbose' && key != 'file') {
          baasConn[key] = moreOptions[key];
        }
      });
      baasConn.wantLogging = opt.options.verbose;
      baasConn.buildCurl = opt.options.superverbose;
      if (opt.options.endpoint) {
        baasConn.URI = opt.options.endpoint; // eg, https://amer-apibaas-prod.apigee.net/appservices/
      }
    }
    else {
      baasConn = {};

      if (opt.options.username) {
        baasConn.username = opt.options.username;
        if (opt.options.password) {
          baasConn.password = opt.options.password;
        }
        else {
          baasConn.password = readlineSync.question(' Password for '+ baasConn.username + ' : ',
                                                    {hideEchoBack: true});
        }
      }
      else if (opt.options.clientid) {
        baasConn.clientid = opt.options.clientid;
        if (opt.options.clientsecret) {
          baasConn.clientsecret = opt.options.clientsecret;
        }
        else {
          baasConn.clientsecret = readlineSync.question(' Client Secret for '+ baasConn.clientid + ' : ',
                                                        {hideEchoBack: true});
        }
      }
      baasConn.org = opt.options.org;
      baasConn.app = opt.options.app;
      baasConn.wantLogging = opt.options.verbose;
      baasConn.buildCurl = opt.options.superverbose;
      baasConn.URI = opt.options.endpoint; // eg, https://amer-apibaas-prod.apigee.net/appservices/
      baasConn.collection = opt.options.collection;
    }

    if ( !baasConn.org || !baasConn.app) {
      console.log('must supply baas org and app');
      if (getopt) { getopt.showHelp(); }
      process.exit(1);
    }

    if ( ! opt.options.anonymous) {
      if ( !(baasConn.clientid && baasConn.clientsecret) &&
           !(baasConn.username && baasConn.password)) {
        console.log('must supply username+password -or- clientid+clientsecret, or specify --anonymous');
        if (getopt) { getopt.showHelp(); }
        process.exit(1);
      }
    }
    return baasConn;
  }



  /*
   * ugCollectionForEach
   *
   * iterates through all items in a collection within Apigee Edge BaaS.
   * Uses the Usergrid client object from the usergrid module.
   *
   * @param ugClient - the authenticated client object
   * @param options - the options for a collection. Pass type and qs.
   * @param f - function called with each UG entity. Accepts a single argument.
   * @param doneCb - called in case of error or success.
   *
   *********************************************/
  function ugCollectionForEach (ugClient, options, f, doneCb) {
    // call the function f once for each item in a collection
    var results = {count: 0, failCount: 0, page: 0};
    if ( ! options.qs) {
      doneCb(new Error('missing qs property in the options argument'), null);
    }
    if ( ! options.type) {
      doneCb(new Error('missing type property in the options argument'), null);
    }

    ugClient.createCollection(options, function (e, collection) {
      var e2;
      function doOnePage(collection, cb) {
        while(collection.hasNextEntity()) {
          f(collection.getNextEntity(), results);
          results.count++;
        }
        if (collection.hasNextPage()) {
          collection.getNextPage(function(e){
            if (e) {
              e2 = new Error('could not get next page of entities');
              e2.wrappedError = e;
              cb(e2, results);
            }
            else {
              results.page++;
              logWrite('page %d', results.page);
              doOnePage(collection, cb);
            }
          });
        }
        else {
          cb(null, results);
        }
      }

      if (e) {
        e2 = new Error('could not make or get collection');
        e2.wrappedError = e;
        doneCb(e2, null);
      }
      else {
        doOnePage(collection, doneCb);
      }
    });
  }


  module.exports = {
    logWrite : logWrite,
    elapsedToHHMMSS : elapsedToHHMMSS,
    usergridAuth : usergridAuth,
    processOptions : processOptions,
    ugCollectionForEach : ugCollectionForEach
  };


}(this));
