#! /usr/local/bin/node
// findSharedFlowAccess.js
// ------------------------------------------------------------------
// in Apigee, find all policies in all proxies that call out to a SharedFlow
//
// last saved: <2022-November-15 13:48:48>
/* jshint node:true, esversion:9, strict:implied */

const fs = require('fs'),
      path = require('path'),
      util = require('util'),
      tmp      = require('tmp-promise'),
      AdmZip   = require('adm-zip'),
      DOM      = require('@xmldom/xmldom').DOMParser,
      xpath    = require('xpath'),
      apigeejs = require('apigee-edge-js'),
      common = apigeejs.utility,
      apigee = apigeejs.apigee,
      Getopt = require('node-getopt'),
      version = '20220607-0930',
      getopt = new Getopt(common.commonOptions.concat([
      ['s' , 'sharedflow=ARG', 'Optional. SharedFlow name to find. default: find any sharedflow reference.'],
      ['' , 'deployed', 'Optional. Search only proxies that are deployed to any environment.'],
      ['' , 'environment=ARG', 'Optional. Search only proxies that are deployed to the specified environment.'],
      ['' , 'regex=ARG', 'Optional. Search only proxies with names matching a regular expression.'],
      ])).bindHelp();

// ========================================================

function processZipBundle(namerev, zipfile) {
  // temporarily unzip the file and then scan the dir

    let zip = new AdmZip(zipfile),
        zipEntries = zip.getEntries(),
        policyFileRe = new RegExp('^apiproxy/policies/[^/]+\\.xml$'),
        policies = zipEntries.filter( entry => entry.entryName.match(policyFileRe));

    let flowCallouts = policies.filter(entry => {
        let data = entry.getData().toString('utf8'),
            doc = new DOM().parseFromString(data),
            policyType = xpath.select('/*', doc)[0].tagName;

        let found = (policyType == 'FlowCallout');
        if (found && opt.options.sharedflow) {
          let target = xpath.select('/FlowCallout/SharedFlowBundle', doc)[0].value;
          found = (target == opt.options.sharedflow);
        }
        return found;
      });
  return flowCallouts.length ?
    {
      ...namerev,
      flowCalloutPolicies: flowCallouts.map(fc => fc.name)
    } :
    null;
}

function getExporter(org, tmpdir) {
  return ({name, revision}) => {
    return org.proxies.export({name:name, revision:revision})
      .then( result => {
        let fqfn = path.join(tmpdir, result.filename);
      fs.writeFileSync(fqfn, result.buffer);
      // if (opt.options.verbose) {
      //   common.logWrite('export ok file: %s', fqfn);
      // }
      return fqfn;
    });
  };
}

console.log(
  `Apigee SharedFlow check tool, version: ${version}\n` +
    `Node.js ${process.version}\n`);

common.logWrite('start');

// process.argv array starts with 'node' and 'scriptname.js'
let opt = getopt.parse(process.argv.slice(2));

common.verifyCommonRequiredParameters(opt.options, getopt);

let options = {
      mgmtServer: opt.options.mgmtserver,
      org : opt.options.org,
      user: opt.options.username,
      password: opt.options.password,
      verbosity: opt.options.verbose || 0
    };

apigee.connect(common.optToOptions(opt))
  .then(org => {
    let p = null;
    if( opt.options.deployed || opt.options.environment) {
      let opts = opt.options.environment ? {environment:opt.options.environment} : {};
      p = org.proxies.getDeployments(opts)
        .then(r =>
              r.deployments.map(d => ({name: d.apiProxy, revision:d.revision})));
      // array of {name, revision}
      if (opt.options.regex) {
        // filter on name
        p = p
          .then(pairs => pairs.filter( ({name}) => name.match(new RegExp(opt.options.regex))));
      }
    }
    else {
      // get all proxies
      p = org.proxies.get()
        .then(r => r.proxies.map(p => p.name));
      if (opt.options.regex) {
        // filter on name
        let re = new RegExp(opt.options.regex);
        p = p
          .then(proxies => proxies.filter( name => name.match(re)));
      }
      // get latest revision of each
      p = p.then(a => {
          let reducer = (p, name) =>
            p.then(a =>
                 org.proxies.get({name})
                 .then( ({revision}) => [...a, {name, revision:Math.max.apply(Math,revision.map(c => Number(c)))}]));
          return a.reduce(reducer, Promise.resolve([])); // array of {name, revision}
        });
    }

    return p
      .then(pairs =>
            ({tmpdir:tmp.dirSync({unsafeCleanup:true, prefix: 'findSharedFlowAccess'}), pairs}))
      .then(({tmpdir, pairs}) => {
        let exportOne = getExporter(org, tmpdir.name);
        let reducer = (p, namerev) =>
        p.then(a =>
               exportOne(namerev)
               .then(zipFilename =>
                     [...a, processZipBundle(namerev, zipFilename)]));
        return pairs.reduce(reducer, Promise.resolve([])) // reduce to those FC, maybe to specific SharedFlow
          .then(r => r.filter(r => !!r))
          .then(r => (tmpdir.removeCallback(), r));
      });
  })
  .then(r => console.log(JSON.stringify(r, null, 2)))

  .catch( e => console.log('while executing, error: ' + util.format(e)) );
