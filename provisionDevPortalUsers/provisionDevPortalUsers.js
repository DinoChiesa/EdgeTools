#! /usr/local/bin/node
/*jslint node:true */
// provisionDevPortalUsers.js
// ------------------------------------------------------------------

// Create new devportal users via REST APIs. This script reads a .csv
// file for a list of users, and then provisions those users in a
// specified Drupal server.
//
// Unpack this script into its own directory, and run this command
// before invoking the script the first time:
//
//    npm install
//
// Invoke the script with no arguments to get help.
//
// The CSV file should have a structure like this:
//
//   username,email,first_name,last_name
//   dino1,dchiesa+dino1@apigee.com,Dino,Chiesa
//   dino2,dchiesa+dino2@apigee.com,Dino,Chiesa
//   dino3,dchiesa+dino3@apigee.com,Dino,Chiesa
//   dino4,dchiesa+dino4@apigee.com,Dino,Chiesa
//
// Actually the ordering of the fields is unimportant. The headers must
// be included in the first line, and those headers must have those
// names.
//
// The script will read in the lines, then create developers with those
// email addresses and "drupal user names" in the dev portal. If a user
// with the given username or email already exists in Drupal, that one
// will be skipped.
//
// last saved: <2016-April-27 18:45:09>
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
    csvparser = require('fast-csv'),
    Getopt = require('node-getopt'),
    version = 'Thursday, 19 March 2015, 11:38',
    netrc = require('netrc')(),
    drupalUrl,
    gForumsVid,
    defaultContentFile = 'devportalusers.csv',
    getopt = new Getopt([
      ['S' , 'server=ARG', 'the url, including optional port and the base path (aka "endpoint")of the "services" module, of Drupal server. Eg, http://drupalserver/rest'],
      ['u' , 'username=ARG', 'Drupal admin user.'],
      ['p' , 'password=ARG', 'password for the Drupal user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. Use this in lieu of -u/-p'],
      ['d' , 'datafile=ARG', 'File containing csv list of users. Defaults to ' + defaultContentFile + ' . The file should have fields with one header line. Fields can appear in any order: username,email,first_name,last_name. The timezone field is optional.'],
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

  if (gOptions.options.verbose) {
    console.log('login');
  }
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
  if (gOptions.options.verbose) {
    console.log('logout');
  }
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

function readDataFile(cb) {
  var result = [];
  if (gOptions.options.verbose) {
    console.log('data file: ' + gOptions.options.datafile);
  }
  csvparser
    .fromPath(gOptions.options.datafile,  {headers: true})
    .on("data", function(data){
      if (data.email !== '' && data.username !== '') {
        result.push(data);
      }
    })
    .on("end", function(){
      if (gOptions.options.verbose) {
        console.log('read %d users.', result.length);
      }
      cb(null, result);
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

function generateContrivedPassword(len) {
  var c = function() {
        var m = Math.floor(Math.random() * 26),
            a = (Math.floor(Math.random() * 2) * 32);
        return String.fromCharCode(65 + m + a);
      },
      L = len || Math.floor(Math.random() * 7) + 12,
      i,
      pw = '';
  for (i=0; i<L; i++) { pw += c(); }
  return pw;
}


function createOneUser(user, cb) {
  var payload = {
        name : user.username || user.email,
        mail : user.email,
        pass : user.password || generateContrivedPassword(),
        status : 1,
        timezone: user.timezone || "America/Los_Angeles"
      },
      opts = {
        url : joinUrlElements(gOptions.options.server, '/user'),
        headers : copyHash(gRequestHeaders)
      };

  if (user.first_name) {
    payload.field_first_name = { und: [{ value: user.first_name }] };
  }

  if (user.last_name) {
    payload.field_last_name = { und: [{ value: user.last_name }] };
  }

  opts.headers['content-type'] = 'application/json';

  opts.body = JSON.stringify(payload);

  if (gOptions.options.verbose) {
    console.log('create user: ' + payload.name + '/' + payload.mail);
  }
  request.post(opts, function (error, response, body) {
    if (error) {
      console.log('error while creating user: ' + JSON.stringify(error));
      cb(error);
      return;
    }
    if (response.statusCode != 200) {
      console.log('status: ' + response.statusCode );
      cb({error: 'bad status ' + response.statusCode,
         moreinfo : 'while creating user'});
      return;
    }
    // response is like this:
    // {"uid":"7","uri":"http://dev-wagov1.devportal.apigee.com/rest/user/7"}
    body = JSON.parse(body);

    // now ask to send the 'password reset' email:
    opts.url = joinUrlElements(body.uri, 'password_reset');
    opts.body = '{}';
    request.post(opts, function(error, response, body2){
      if (error) {
        console.log('error while requesting password reset: ' + JSON.stringify(error));
        cb(error);
        return;
      }
      if (response.statusCode != 200) {
        console.log('status: ' + response.statusCode );
        cb({error: 'bad status ' + response.statusCode,
           moreinfo: 'while requesting password reset' });
        return;
      }
      cb(null, body);
    });
  });
}



// ========================================================

console.log(
  'Edge Dev Portal User Provisioner Tool, version: ' + version + '\n' +
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

if ( !gOptions.options.datafile) {
  gOptions.options.datafile = defaultContentFile;
}

gOptions.options.datafile = path.resolve('.', gOptions.options.datafile);

if ( ! fs.existsSync(gOptions.options.datafile)) {
  console.log('The content file - %s - does not exist.', gOptions.options.datafile);
  getopt.showHelp();
  process.exit(1);
}

var gRequestHeaders = {
    accept: 'application/json'
};


readDataFile(function(error, newUsersToCreate) {
  if (error) {
    console.log('error reading user data file: ' + JSON.stringify(error));
    return;
  }
  if (newUsersToCreate.length > 0) {
    drupalLogin(function(error, result){
      if (error) {
        console.log('error while logging in: ' + JSON.stringify(error));
        return;
      }

      getAllUsers(function(error, currentUsers){
        var existing;
        if (error) {
          console.log('error while reading users: ' + JSON.stringify(error));
          return;
        }
        existing = {
          emails : currentUsers.map(function(item){return item.mail;}),
          names : currentUsers.map(function(item){return item.name;})
        };

        if (gOptions.options.verbose) {
          console.log('checking for uniqueness...');
        }
        newUsersToCreate = newUsersToCreate.filter(function(item){
          if (item.email === '' || item.username === '') {return false;}
          //console.log('checking: ' + JSON.stringify(item));
          var ix1 = existing.emails.indexOf(item.email), ix2;
          if (ix1 >= 0) {
            console.log('email already exists: ' + item.email);
          }
          ix2 = existing.names.indexOf(item.username);
          if (ix2 >= 0) {
            console.log('username already exists: ' + item.username);
          }
          return (ix1<0) && (ix2<0);
        });

        async.mapSeries(newUsersToCreate, createOneUser, function (e, createResponse) {
          if (e) {
            console.log('error while creating users: ' + JSON.stringify(e));
            return;
          }
          if (gOptions.options.verbose) {
            console.log('all users created...');
          }
          drupalLogout(function(error, result) {
            console.log('done');
          });
        });
      });
    });
  }
  else {
    console.log('error: cannot read user data file, or there are no users listed there...');
  }
});
