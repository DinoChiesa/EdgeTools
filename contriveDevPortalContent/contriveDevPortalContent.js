#! /usr/local/bin/node
/*jslint node:true */
// contriveDevPortalContent.js
// ------------------------------------------------------------------
// Create "canned" dev portal content (forum, faqs) via REST APIs.
//
// last saved: <2015-March-25 18:16:00>

var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    async = require('async'),
    Getopt = require('node-getopt'),
    version = 'Wednesday, 18 March 2015, 12:45',
    netrc = require('netrc')(),
    exportDir = 'exported-' + new Date().getTime(),  // ms since epoch
    drupalUrl,
    faqWeight = 10,
    gForumsVid,
    defaultContentFile = 'portalcontent.json',
    getopt = new Getopt([
      ['S' , 'server=ARG', 'the url, including optional port and the base path (aka "endpoint")of the "services" module, of Drupal server. Eg, http://drupalserver/rest'],
      ['u' , 'username=ARG', 'Drupal admin user.'],
      ['p' , 'password=ARG', 'password for the Drupal user.'],
      ['n' , 'netrc', 'retrieve the username + password from the .netrc file. Use this in lieu of -u/-p'],
      ['c' , 'content=ARG', 'File containing portal content. Defaults to ' + defaultContentFile],
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


function getAllNodesOfType(type, cb) {
  var opts = {
        url : joinUrlElements(gOptions.options.server, '/node'),
        headers : copyHash(gRequestHeaders),
        qs: {pagesize: 30, 'parameters[type]': type}
      };

    // curl -i -X GET \
    //   -H Cookie:....
    //   -H Accept:application/json \
    //   'http://server/rest/node?pagesize=30&parameters\[type\]=forum'

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
    // return array of the node elements
    cb(null, JSON.parse(body));
  });
}



function getAllForums(cb) {
  var opts = {
        url : joinUrlElements(gOptions.options.server, '/taxonomy_vocabulary'),
        headers : copyHash(gRequestHeaders),
        qs: {pagesize: 30, 'parameters[machine_name]': 'forums'}
      };

  // Step 1: first get the vocabulary that corresponds to "forums":
  // curl -i -X GET  \
  //   -H Cookie:....\
  //   -H Accept:application/json \
  //   'http://myserver/rest/taxonomy_vocabulary?parameters\[machine_name\]=forums'

  request.get(opts, function (error, response, body) {
    var type;
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
    type = Object.prototype.toString.call(body);
    if (type !== "[object Array]" || body.length !== 1 || !body[0] || !body[0].vid) {
      cb({error: 'response is not as expected'});
      return;
    }

    // Step 2: get the terms for that vocabulary. This gives all forum names and IDs:
    // curl -i -X GET \
    //  -H Cookie:.... \
    //  -H Accept:application/json \
    //  'http://myserver/rest/taxonomy_term?parameters\[vid\]=1'
    gForumsVid = body[0].vid;
    opts.url = joinUrlElements(gOptions.options.server, '/taxonomy_term');
    opts.qs = {'parameters[vid]': body[0].vid};
    request.get(opts, function (error, response, body) {
      var type;
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
  });
}



function deleteSingleNode(item, cb) {
  // curl -i -X DELETE \
  //   -H Cookie:sessname=sessid \
  //   -H X-CSRF-Token:tokenhere \
  //   -H Accept:application/json \
  //   http://myserver/rest/node/8

  var opts = {
        url : item.uri,
        headers : gRequestHeaders
      };

  if (gOptions.options.verbose) {
    console.log('delete node: ' + item.title);
  }

  request.del(opts, function (error, response, body) {
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


function deleteSingleForum(term, cb) {
  // curl -i -X DELETE \
  //   -H Cookie:sessname=sessid \
  //   -H X-CSRF-Token:tokenhere \
  //   -H Accept:application/json \
  //   http://myserver/rest/taxonomy_term/7
  var opts = {
        url : joinUrlElements(gOptions.options.server, '/taxonomy_term', term.tid),
        headers : gRequestHeaders
      };

  if (gOptions.options.verbose) {
    console.log('delete forum/term: ' + term.name);
  }

  request.del(opts, function (error, response, body) {
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




function createForumAndTopics(item, cb) {
  var payload = {
        vid : gForumsVid,
        name : item.name,
        description : item.description || "",
        format : null,
        weight : item.weight || 10
      },
      opts = {
        url : joinUrlElements(gOptions.options.server, '/taxonomy_term'),
        headers : copyHash(gRequestHeaders),
        body : JSON.stringify(payload)
      };
  opts.headers['content-type'] = 'application/json';

  // create the forum. In Drupal-speak, we are adding a new "term".
  request.post(opts, function (error, response, body) {
    if (error) {
      console.log(error);
      cb(error);
      return;
    }
    if (response.statusCode != 200) {
      console.log('status: ' + response.statusCode );
      cb({error: 'bad status ' + response.statusCode,
         action: 'adding a term: ' + item.name});
      return;
    }
    if (gOptions.options.verbose) {
      console.log('created forum(term): ' + item.name);
    }
    // query to get the tid of that forum "term"
    delete opts.body;
    delete opts.headers['content-type'];
    opts.qs = {'parameters[name]' : item.name};
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

      body = JSON.parse(body);
      type = Object.prototype.toString.call(body);
      if (type !== "[object Array]" || body.length !== 1 || !body[0] || !body[0].tid) {
        cb({error: 'response is not as expected'});
        return;
      }

      if (item.posts && item.posts.length > 0) {
        async.mapSeries(item.posts, makeForumTopicCreator(body[0].tid), function (e, deleteResponse){
          if (e) {
            console.log(e);
            cb(e);
            return;
          }
          if (gOptions.options.verbose) {
            console.log('  all forum posts created...');
          }
          cb(null);
        });
      }
      else {
        cb(null);
      }
    });
  });
}


function makeForumTopicCreator(tid) {
  return function createSingleForumTopic(item, cb) {
    // curl -i -X POST \
    //   -H Cookie:....\
    //   -H X-CSRF-Token:...\
    //   -H Accept:application/json \
    //   -H content-type:application/json \
    //   http://myserver/rest/node \
    //   -d '{
    //     "type": "forum",
    //     "title": "test post?",
    //     "language": "und",
    //     "taxonomy_forums": { "und": "1" },
    //     "body": {
    //       "und": [{
    //         "value" : "test post",
    //         "summary": "this is a test1",
    //         "format": "full_html"
    //       }]
    //     }
    //   }'

    var payload = {
          type: 'forum',
          title : item.title,
          language : 'und',
          taxonomy_forums: { und: tid },
          body: {
            und: [{
              value : item.text,
              summary: "",
              format: "full_html"
            }]
          }
        },
        opts = {
          url : joinUrlElements(gOptions.options.server, '/node'),
          headers : copyHash(gRequestHeaders),
          body : JSON.stringify(payload)
        };
    opts.headers['content-type'] = 'application/json';
    if (gOptions.options.verbose) {
      console.log('  create topic: ' + item.title);
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
  };
}


function createFaq(item, cb) {
  var payload = {
        type: 'faq',
        title : item.title,
        language : 'und',
        status: 1,
        comment: 1,
        promote: 1,
        weight: faqWeight,
        body: {
          und: [{
            value : item.text,
            summary: "",
            format: "full_html"
          }]
        }
      },
      opts = {
        url : joinUrlElements(gOptions.options.server, '/node'),
        headers : copyHash(gRequestHeaders),
        body : JSON.stringify(payload)
      };
  opts.headers['content-type'] = 'application/json';
  if (gOptions.options.verbose) {
    console.log('  create faq: ' + item.title);
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
    faqWeight += 10;
    cb(null);
  });
}


function deleteNodesOfType(type, cb) {
  getAllNodesOfType(type, function(error, result){
    var r;
    if (error) {
      console.log('error getting %s topics: %s', type, JSON.stringify(error));
      cb(error);
      return;
    }
    r = result.map(function(item){return {uri:item.uri, title:item.title};});

    async.mapSeries(r, deleteSingleNode, function (e, deleteResponse){
      if (e) {
        console.log('error deleting nodes: ' + JSON.stringify(e));
        cb(e);
        return;
      }

      if (gOptions.options.verbose) {
        if (r.length > 0) {
          console.log('all %s nodes deleted...', type);
        }
        else {
          console.log('no %s nodes to delete...', type);
        }
      }

      cb(null, r);
    });
  });
}

// ========================================================

console.log(
  'Edge Dev Portal Forum Content Contriver Tool, version: ' + version + '\n' +
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

if ( !gOptions.options.content) {
  gOptions.options.content = defaultContentFile;
}

gOptions.options.content = path.resolve('.', gOptions.options.content);

if ( ! fs.existsSync(gOptions.options.content)) {
  console.log('The content file - %s - does not exist.', gOptions.options.content);
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
  if (gOptions.options.verbose) {
    console.log('content file: ' + gOptions.options.content);
  }
  var content = require(gOptions.options.content);
  if ( ! content.forums && !content.faqs) {
    console.log('error: cannot read content file, or there is no content there...');
  }
  if ( ! content.forums) { content.forums = []; }
  if ( ! content.faqs) { content.faqs = []; }

  deleteNodesOfType('forum', function(error, result){
    if (error) {
      return;
    }
    getAllForums(function(error, result) {
      if (error) {
        console.log('error getting forums: ' + JSON.stringify(error));
        return;
      }
      async.mapSeries(result, deleteSingleForum, function (e, deleteResponse){
        if (e) {
          console.log('while deleting forums:\n' + JSON.stringify(e, null, 2));
          return;
        }

        async.mapSeries(content.forums, createForumAndTopics, function (e, createResponse){
          if (e) {
            console.log('while creating new forums:\n' + JSON.stringify(e, null, 2));
            return;
          }
          console.log('all new forum nodes created...');

          deleteNodesOfType('faq', function(error, result){
            if (error) {
              return;
            }

            async.mapSeries(content.faqs, createFaq, function (e, createResponse){
              if (e) {
                console.log('while creating new faqs:\n' + JSON.stringify(e, null, 2));
                return;
              }
              console.log('all new faq nodes created...');

              drupalLogout(function(error, result){ console.log('done'); });

            });
          });
        });
      });
    });
  });
});
