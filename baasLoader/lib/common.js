// common.js
// ------------------------------------------------------------------
//
// common functions used by the loader and deleteAllItems scripts.
//
// created: Mon Jun  6 17:32:20 2016
// last saved: <2016-June-07 20:03:59>

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
          URI : baasConn.URI || 'https://api.usergrid.com',
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
      fn({error: "missing credentials"});
    }
  }

  function processOptions(getopt, args) {
    var opt = getopt.parse(args), baasConn;

    if (opt.options.config) {
      baasConn = JSON.parse(fs.readFileSync(opt.options.config, 'utf8'));
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
      getopt.showHelp();
      process.exit(1);
    }

    if ( ! ((baasConn.clientid && baasConn.clientsecret) ||
            (baasConn.username && baasConn.password))) {
      console.log('must supply username+password -or- clientid+clientsecret');
      getopt.showHelp();
      process.exit(1);
    }
    return baasConn;
  }

  module.exports = {
    logWrite : logWrite,
    elapsedToHHMMSS : elapsedToHHMMSS,
    usergridAuth : usergridAuth,
    processOptions : processOptions
  };


}(this));
