#! /usr/local/bin/node
// findJavaPolicies.js
// ------------------------------------------------------------------
// In Apigee, find all policies in all proxies that reference a Java callout.
// Or, alternatively, find proxies in an org that include a specific JAR as a resource.
//
// This tool does not examine environment-wide or organization-wide Java resources.
//
// last saved: <2022-June-07 14:40:25>
/*jslint node:true, esversion:9, strict:implied */

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
      version = '20220607-1438',
      getopt = new Getopt(common.commonOptions.concat([
      ['J' , 'jar=ARG', 'Optional. JAR name to find. Default: search for all JavaCallout policies.'],
      ['' , 'deployed', 'Optional. Search only proxies that are deployed to any environment.'],
      ['' , 'environment=ARG', 'Optional. Search only proxies that are deployed to the specified environment.'],
      ['' , 'regex', 'Optional. Treat the -J option as a Regular Expression. Default: perform string match.'],
      ['' , 'proxyregex=ARG', 'Optional. filter on proxies that match this regex. Default: scan all proxies.']
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

        let found = (policyType == 'JavaCallout');
        if (found && opt.options.jar) {
          let url = xpath.select('/JavaCallout/ResourceURL', doc)[0].value.slice(7);
          found = (opt.options.regex) ? target.match(new RegExp(opt.options.jar)) : (target == opt.options.jar);
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
  `Apigee JavaCallout/JAR check tool, version: ${version}\n` +
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
      if (opt.options.proxyregex) {
        // filter on proxy name
        p = p
          .then(pairs => pairs.filter( ({name}) => name.match(new RegExp(opt.options.proxyregex))));
      }
    }
    else {
      // get all proxies
      p = org.proxies.get()
        .then(r => r.proxies.map(p => p.name));
      if (opt.options.proxyregex) {
        // filter on name
        let re = new RegExp(opt.options.proxyregex);
        p = p.then(proxies => proxies.filter( name => name.match(re)));
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
            ({tmpdir:tmp.dirSync({unsafeCleanup:true, prefix: 'findJavaPolicies'}), pairs}))
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
