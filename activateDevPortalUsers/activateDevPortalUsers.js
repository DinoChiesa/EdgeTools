#! /usr/local/bin/node
/*jslint node:true */
// activateDevPortalUsers.js
// ------------------------------------------------------------------
//
// List and optionally activate devportal users via REST APIs.
//
// This script depends on nodejs.
// Unpack this script into its own directory, and run this command
// before invoking the script the first time:
//
//    npm install
//
// Invoke the script with no arguments to get help.
//
// last saved: <2016-April-27 18:41:22>
//
// Copyright (c) 2015 Dino Chiesa and Apigee Corp
// All Rights Reserved.
//
// This code is licensed under a Revised BSD-style 3-clause license:
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    - Redistributions of source code must retain the above copyright
//      notice, this list of conditions and the disclaimer that follows.
//
//    - Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the disclaimer that follows in
//      the documentation and/or other materials provided with the
//      distribution.
//
//    - The name of the contributors may not be used to endorse or promote
//      products derived from this software without specific prior written
//      permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
// IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
// PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
// TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
// LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//


var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    readlineSync = require('readline-sync'),
    async = require('async'),
    sprintf=require("sprintf-js").sprintf,
    Getopt = require('node-getopt'),
    prompt = require('prompt'),
    version = 'Wednesday,  8 April 2015, 09:54',
    netrc = require('netrc')(),
    drupalUrl,
    gForumsVid,
    getopt = new Getopt([
      ['S' , 'server=ARG', 'the url, including optional port and the base path (aka "endpoint")of the "services" module, of Drupal server. Eg, http://drupalserver/rest'],
      ['u' , 'username=ARG', 'Drupal admin user.'],
      ['p' , 'password=ARG', 'password for the Drupal user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. Use this in lieu of -u/-p'],
      ['v', 'verbose'],
      ['h' , 'help']
    ]).bindHelp();


function joinUrlElements() {
  var re1 = new RegExp('^\\/|\\/$', 'g'),
      elts = Array.prototype.slice.call(arguments);
  return elts.map(function(element){
    if ( ! element) {return '';}
    return element.replace(re1,""); }).join('/');
}

function copyHash(obj) {
  // shallow copy an object, looking only 1-level deep
  var copy = {};
  if (null !== obj && typeof obj == "object") {
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) {copy[attr] = obj[attr];}
    }
  }
  return copy;
}

function drupalLogin(cb) {
  var opts = {
        url : joinUrlElements(gOptions.options.server, '/user/login'),
        headers : copyHash(gRequestHeaders),
        body : JSON.stringify({
          username : gOptions.options.username,
          password : gOptions.options.password
        })
      };

  // The x-csrf-token is documented as being required for the call to
  // /user/login, but in my tests I observed that it is not actually
  // required. Not for nodejs clients anyway.
  //

  opts.headers['content-type'] = 'application/json';

  //console.log('drupalLogin opts=' + JSON.stringify(opts, null, 2));

  request.post(opts,
               function (error, response, body) {
                 var stack;
                 if (error) {
                   console.log(error);
                   cb(error);
                   return;
                 }
                 if (response.statusCode != 200) {
                   console.log('status: ' + response.statusCode );
                   cb({error: 'bad status ' + response.statusCode });
                   return;
                 }

                 body = JSON.parse(body);
                 if ( ! (body.sessid && body.session_name && body.token)) {
                   cb({error: 'can\'t find valid session in response', body:body});
                   return;
                 }
                 if (gOptions.options.verbose) {
                   console.log('sess name:', body.session_name);
                   console.log('sess id:', body.sessid);
                   console.log('token:', body.token);
                 }

                 console.log('logged in as: %s %s',
                             body.user.field_first_name.und[0].value,
                             body.user.field_last_name.und[0].value);

                 // check for administrator role
                 var roles = Object.keys(body.user.roles).map(function(v){return body.user.roles[v];});
                 if (roles.indexOf("administrator") < 0) {
                   cb({error : 'not an administrator', foundroles: roles});
                 }

                 // set cookie and token globally
                 gRequestHeaders.cookie = body.session_name + '=' + body.sessid;
                 gRequestHeaders['x-csrf-token'] = body.token;
                 cb(null, body);
               });
}


function drupalLogout(cb) {
  var opts = {
        url : joinUrlElements(gOptions.options.server, '/user/logout'),
        headers : copyHash(gRequestHeaders),
        body : ''
      };

  opts.headers['content-type'] = 'application/json';
  // if (gOptions.options.verbose) {
  //   console.log('logout');
  // }
  request.post(opts, function (error, response, body) {
    if (error) {
      console.log(error);
      cb(error);
      return;
    }
    if (response.statusCode != 200) {
      console.log('status: ' + response.statusCode );
      cb({error: 'bad status ' + response.statusCode });
      return;
    }
    cb(null);
  });
}


function getAllUsers(cb) {
  var opts = {
        url : joinUrlElements(gOptions.options.server, '/user'),
        headers : copyHash(gRequestHeaders),
        qs: {pagesize: 300}
      };

    // curl -i -X GET \
    //   -H Cookie:....
    //   -H Accept:application/json \
    //   'http://server/rest/user?pagesize=300'

  request.get(opts, function (error, response, body) {
    if (error) {
      console.log(error);
      cb(error);
      return;
    }
    if (response.statusCode != 200) {
      console.log('status: ' + response.statusCode );
      cb({error: 'bad status ' + response.statusCode });
      return;
    }
    cb(null, JSON.parse(body));
  });
}


function activateOneUser(user, cb) {
  var payload = {
        status : "1" // string.  1 for active, 0 for inactive
      },
      opts = {
        url : user.uri,
        headers : copyHash(gRequestHeaders)
      };

  opts.headers['content-type'] = 'application/json';

  opts.body = JSON.stringify(payload);

  if (gOptions.options.verbose) {
    console.log('activate user: ' + user.name + '/' + user.mail);
  }
  request.put(opts, function (error, response, body) {
    if (error) {
      console.log('error while activating user: ' + JSON.stringify(error));
      cb(error);
      return 1;
    }
    if (response.statusCode != 200) {
      console.log('status: ' + response.statusCode );
      cb({error: 'bad status ' + response.statusCode,
         moreinfo : 'while activating user'});
      return 1;
    }
    // response is like this:
    // {"status":"1","uid":"6","roles":{"2":"authenticated user"}}
    body = JSON.parse(body);
    cb(null, body);
  });
}


function handleActivation(users, cb) {
  var schema = {
        properties: {
          index: {
            description: 'Activate which user? (Q to quit)',
            pattern: /^([1-9][0-9]*)|([qQ].*)$/,
            message: 'Specify a number, Q to quit',
            required: true
          }
        }
      };

  function handleOneInput() {
    showUsers();
    prompt.get(schema, function (e, result) {
      var n, user;
      if (e) { console.log(e); cb(e); return 1; }
      if (result.index.match('^[qQ].*$') ) {
        cb(null);
        return 1;
      }
      n = parseInt(result.index, 10);
      if (n<=0 || n>users.length) {
        console.log('That number is out of range.');
        return handleOneInput();
      }

      user = users[n - 1];
      if (user.status !== 0) {
        console.log('user %s is already active', user.mail);
        return handleOneInput();
      }

      activateOneUser(user, function(e, result){
        if(e) { cb(e); return 1; }

        //console.log('result: ' + JSON.stringify(result, null, 2) + '\n');
        user.status = parseInt(result.status, 10);
        handleOneInput();
      });
    });
  }

  function showUsers() {
    var c = 1;
    console.log('\nusers:\n');
    users.forEach(function(user){
      console.log(sprintf('  %2d %-28s  %-12s', c++, user.mail, (user.status == 1)?'active':'not active'));

      ['created', 'access', 'login', 'status'].forEach(function(prop) {
        user[prop] = parseInt(user[prop], 10);
      });
    });
    console.log('\n');
  }

  prompt.start();
  handleOneInput();
}




// ========================================================

console.log(
  'Edge Dev Portal User Activator Tool, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

// process.argv array starts with 'node' and 'scriptname.js'
var gOptions = getopt.parse(process.argv.slice(2));

if (gOptions.options.netrc) {
  drupalUrl = require('url').parse(gOptions.options.server);
  if ( ! netrc[drupalUrl.hostname]) {
    console.log('The specified host ('+ drupalUrl.hostname +') is not present in the .netrc file.');
    getopt.showHelp();
    process.exit(1);
  }

  gOptions.options.username = netrc[drupalUrl.hostname].login;
  gOptions.options.password = netrc[drupalUrl.hostname].password;
}

if ( !gOptions.options.username) {
  gOptions.options.username = readlineSync.question(' USER NAME  : ');
}

if ( !gOptions.options.password) {
  gOptions.options.password = readlineSync.question(' Password for '+gOptions.options.username + ' : ',
                                                    {hideEchoBack: true});
}

if ( !gOptions.options.username || !gOptions.options.password) {
  console.log('You must provide some way to authenticate to Drupal');
  getopt.showHelp();
  process.exit(1);
}
if ( !gOptions.options.server) {
  console.log('You must specify the Drupal server');
  getopt.showHelp();
  process.exit(1);
}

var gRequestHeaders = {
    accept: 'application/json'
};


drupalLogin(function(error, result){
  if (error) {
    console.log('error while logging in: ' + JSON.stringify(error));
    return;
  }

  getAllUsers(function(error, currentUsers){
    var f = function(user){
      return (user.mail && (user.mail !== ''));
    };
    if (error) {
      console.log('error while reading users: ' + JSON.stringify(error));
      return;
    }

    handleActivation(currentUsers.filter(f), function(e, result){
      if (e) { console.log(e); return 1; }
      drupalLogout(function(error, result) {
        console.log('done');
      });
    });

  });
});
