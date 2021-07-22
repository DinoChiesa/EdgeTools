#! /usr/local/bin/node
/*jslint node:true */
// bulkExport.js
// ------------------------------------------------------------------
// export one or more Apigee proxy bundles
//
// Copyright 2017-2021 Google LLC.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// last saved: <2021-March-23 08:50:14>

const fs         = require('fs'),
      path       = require('path'),
      util       = require('util'),
      mkdirp     = require('mkdirp'),
      apigeejs   = require('apigee-edge-js'),
      common     = apigeejs.utility,
      apigee     = apigeejs.apigee,
      sprintf    = require('sprintf-js').sprintf,
      Getopt     = require('node-getopt'),
      version    = '20210323-0849',
      defaults   = { destination : 'exported-' + timeString() },
      getopt     = new Getopt(common.commonOptions.concat([
        ['' , 'name=ARG', 'name of existing API proxy or shared flow'],
        ['P' , 'pattern=ARG', 'regex pattern for name of existing API proxy or shared flow; this always exports the latest revision.'],
        ['D' , 'destination=ARG', 'directory for export. Default: exported'],
        ['t' , 'trial', 'trial only. Do not actually export'],
        ['S' , 'sharedflow', 'search and export sharedflows, not proxies. Default: export proxies.'],
        ['R' , 'revision=ARG', 'revision of the asset to export. Default: latest'],
        ['e' , 'env=ARG', 'environment. Exports only APIs that are deployed to this environment. Default: all apis']
      ])).bindHelp();

let collection = 'proxies';
function timeString() {
  return (new Date())
    .toISOString()
    .replace(/[-:]/g,'')
    .replace(/T/,'-')
    .replace(/\.\d\d\dZ$/,'');
}

function exportOneRevision(org, name, revision) {
  let artifactType = (opt.options.sharedflow)?'sharedflow':'apiproxy';
  return new Promise( (resolve, reject) => {
    if (opt.options.trial) {
      common.logWrite('WOULD EXPORT %s HERE; %s, revision:%s',
                      artifactType, name, revision);
      return resolve(path.join(opt.options.destination,
                               sprintf("%s-%s-%s-TIMESTAMP.zip", artifactType, name, revision)));
    }
    return org[collection].export({name:name, revision:revision})
      .then(result => {
        let fullFilename = path.join(opt.options.destination, result.filename);
        fs.writeFileSync(fullFilename, result.buffer);
        return resolve(fullFilename);
      });
  });
}

const findLatestRevision = (org, name) =>
 org[collection].getRevisions({name:name})
    .then(revisions => revisions[revisions.length - 1] );

const findDeployedRevision = (org, name, env) =>
 org[collection].getDeployments({name, env})
  .then( deployment => {
      let revisions = deployment.revision.filter( r => r.state == 'deployed');
      // Today there is just one deployed revision. In the future there may be
      // more than one. Just choose the first one.
      return revisions && revisions.length && revisions[0].name;
  })
  .catch(e => null);

function exportMatchingArtifacts(org, {pattern, env}) {
  let re1 = (pattern) ? new RegExp(pattern) : null;

  return org[collection].get({})
    .then( proxies => {
      if (re1) {
        proxies = proxies.filter( a => a.match(re1) );
      }
      let finder = (env) ? findDeployedRevision : findLatestRevision;

      // if environment is specified, then export the deployed revision
      let reducer = (p, artifactName) =>
          p.then( a =>
                  finder(org, artifactName, env)
                  .then(rev =>
                    (rev) ?
                        exportOneRevision(org, artifactName, rev)
                        .then( filename => [ ...a, {artifactName, filename} ] )
                        : a));
      return proxies
        .reduce(reducer, Promise.resolve([]));
    });
}

// ========================================================
process.on('unhandledRejection',
            r => console.log('\n*** unhandled promise rejection: ' + util.format(r)));

// process.argv array starts with 'node' and 'scriptname.js'
let opt = getopt.parse(process.argv.slice(2));
if (opt.options.verbose) {
  console.log(
    `Apigee Proxy/Sharedflow Export tool, version: ${version}\n` +
      `Node.js ${process.version}\n`);

  common.logWrite('start');
}

if ( opt.options.name && opt.options.pattern ) {
  console.log('You must specify only one of a name, or a pattern for the name, for the proxy or sharedflow to be exported');
  getopt.showHelp();
  process.exit(1);
}

if ( opt.options.revision && opt.options.pattern) {
  console.log('You may not specify a revision when specifying a pattern. Doesn\'t make sense.');
  getopt.showHelp();
  process.exit(1);
}

if ( ! opt.options.destination) {
  opt.options.destination = defaults.destination;
}

if ( ! opt.options.trial) {
  mkdirp.sync(opt.options.destination);
}

collection = (opt.options.sharedflow) ? 'sharedflows' : 'proxies';

common.verifyCommonRequiredParameters(opt.options, getopt);

apigee.connect(common.optToOptions(opt))
  .then(org => {
    common.logWrite('connected');

    if (opt.options.name && opt.options.revision) {
      common.logWrite('exporting');
      return exportOneRevision(org, opt.options.name, opt.options.revision);
    }

    if (opt.options.name) {
      return exportLatestRevision(org, opt.options.name);
    }

    return exportMatchingArtifacts(org, {pattern:opt.options.pattern, env:opt.options.env})
      .then(result => {
        common.logWrite('%s %d %s',
                        (opt.options.trial)?'would export':'exported',
                        result.length,
                        collection);
        return JSON.stringify(result, null, 2);
      });
  })
  .then(result => console.log('\n' + result + '\n'))
  .catch(e => common.logWrite('exception while exporting: ' + util.format(e)));
