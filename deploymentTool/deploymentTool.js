// index.js
// ------------------------------------------------------------------
//
// created: Tue Nov 15 13:44:20 2022
// last saved: <2022-November-15 15:54:56>

/* jshint esversion:9, node:true, strict:implied */
/* global process, console, Buffer */

const inquirer  = require('inquirer'),
      apigeejs  = require('apigee-edge-js'),
      util      = require('util'),
      path      = require('path'),
      fs        = require('fs'),
      childProc = require("child_process"),
      common    = apigeejs.utility,
      apigee    = apigeejs.apigee,
      Getopt    = require('node-getopt'),
      version   = '20221115-1353',
      pageSize  = 20,
      getopt    = new Getopt(common.commonOptions.concat([])).bindHelp();


const ACTIONS = {
        deploy: async function ({org, environment, deployedProxies}) {
          let allProxies = await org.proxies.get({ environment });
          //console.log(JSON.stringify(availableProxies, null, 2));
          allProxies = (allProxies.proxies.map(p => p.name) || []);

          let notDeployedProxies = allProxies.filter( n => !deployedProxies.find( d => d.apiProxy == n)).sort();

          if ( ! notDeployedProxies.length) {
            console.log('no proxies to deploy');
            return;
          }
          let selectedProxy = '';
          do {
            selectedProxy = await inquirer
              .prompt([
                {
                  type: "list",
                  name: "proxy",
                  message: "proxy",
                  pageSize,
                  choices: notDeployedProxies.concat('-QUIT-')
                }
              ])
              .then(async (answers) => {
                if (answers.proxy == '-QUIT-') {
                  return null;
                }
                console.log(`deploying ${answers.proxy}`);
                let result = await org.proxies.deploy({name:answers.proxy, environment})
                  .then( r => true)
                  .catch(e => false);
                if (result) {
                  notDeployedProxies = notDeployedProxies.filter( n => n != answers.proxy);
                }
                return answers.proxy;
              });
          } while (selectedProxy);
        },

        undeploy: async function({org, environment, deployedProxies}) {
          if ( ! deployedProxies.length) {
            console.log('no proxies to undeploy');
            return;
          }
          deployedProxies = deployedProxies.sort((a, b) => a.apiProxy.localeCompare(b.apiProxy) );
          let selectedProxy = '';
          do {
            selectedProxy = await inquirer
              .prompt([
                {
                  type: "list",
                  name: "proxy",
                  message: "proxy",
                  pageSize,
                  choices: deployedProxies.map( e => `${e.apiProxy} (r${e.revision})`).concat('-QUIT-')
                }
              ])
              .then(async (answers) => {
                if (answers.proxy == '-QUIT-') {
                  return null;
                }
                let parts = answers.proxy.split(' ');
                console.log(`undeploying ${answers.proxy}`);
                await org.proxies.undeploy({name:parts[0], environment, revision: parts[1].slice(2, -1)});
                deployedProxies = deployedProxies.filter( e => e.apiProxy != parts[0]);
                return parts[0];
              });
          } while (selectedProxy);
          return;
        }
      };

async function interact(org) {
  let environments = await org.environments.get({});
  let environment = await inquirer
    .prompt([
      {
        type: "list",
        name: "env",
        message: "environment",
        choices: environments
      }
    ])
    .then((answers) => answers.env);

  let action = await inquirer
    .prompt([
      {
        type: "list",
        name: "action",
        message: "action",
        choices: ['deploy', 'undeploy', '-QUIT-']
      }
    ])
    .then((answers) => answers.action);

  if (action == '-QUIT-') {
    return;
  }

  let deployedProxies = await org.proxies.getDeployments({ environment });
  //console.log(JSON.stringify(deployedProxies, null, 2));
  deployedProxies = (deployedProxies.deployments) ? deployedProxies.deployments : [];
  return ACTIONS[action]({org, environment, deployedProxies});
}

const cleanExec = (command) => {
        let split = command.split(' ');
        let spawn = childProc.spawnSync(split[0], split.slice(1));
        let errorText = spawn.stderr && spawn.stderr.toString().trim();

        if (errorText) {
          return null; /* gulp! */
          //throw new Error(errorText);
        }
        else {
          return spawn.stdout.toString().trim();
        }
      };

const defaultTokenGetter = (c) => (answers) => {
        if (answers.variant != 'Edge') {
          return cleanExec('gcloud auth print-access-token').toString('utf8').trim();
        }
        return c && c.token;
      };
// ====================================================================

async function main() {
  console.log(
    `Apigee interactive undeployer tool, version: ${version}\n` +
      `Node.js ${process.version}\n`);

  //common.logWrite('start');

  // read a cache of prior responses
  let cacheFile   = './.cached-responses.json';
  let c = (fs.existsSync(cacheFile)) ? JSON.parse( fs.readFileSync(cacheFile)) : {};
  inquirer
    .prompt([
      {type:'list', name:'variant', message: 'Edge or X/hybrid?', choices: ["Edge", "X/hybrid"], default:c.variant},
      {type:'input', name:'org', message: 'organization name?', default:c.org},
      {type:'input', name:'token', message: 'token?', default: defaultTokenGetter(c)}
    ])
    .then(answers => {
      // re-cache the responses for next time
      fs.writeFileSync(cacheFile, JSON.stringify(answers, null, 2));
      let opt = {
            verbosity: true,
            org: answers.org,
            token: answers.token,
            apigeex : (answers.variant != 'Edge'),
            mgmtserver : (answers.variant != 'Edge') && 'https://apigee.googleapis.com'
          };

      return apigee.connect(opt)
        .then(interact);
    })
    .catch( e => console.error('error: ' + util.format(e) ));
}

main();
