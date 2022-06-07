# How to use this tool ?

This tool exports all of the API Proxies that are loaded into an organization.
or all of the proxies that are deployed to a particular environment.

The result is a directory containing a single ZIP file for each revision of each api proxy.
The names of the zip files are based on the API name and the revision number.


## Requirements

* Node.JS  ">= 12.22.0", npm ">= 8.3.0" installed on your machine
* GIT CLI installed on your machine, to allow `git clone`.

## Installation :

```
$ git clone https://github.com/DinoChiesa/EdgeTools.git

$ cd EdgeTools

$ cd bulkExport

$ npm install
```

## Usage Examples

How to download the latest revision of all proxies?
Once installed run below command from "bulkExport" directory.

For Apigee Edge with basic auth:
```
$ node bulkExport.js --username={{YOURAPIGEEEDGEEMAILADDRESS}} --password={{YOURAPIGEEDGEPASSWORD}} --org={{YOURAPIGEEEDGEORGNAME}} -v

```

For Apigee Edge with a token you obtained previously, export only those APIs that have names that start with the letter p:
```
node ./bulkExport.js --token $TOKEN -o $ORG --pattern '^p.*$'

```

For Apigee X with a token you obtained previously:
```
node ./bulkExport.js  --apigeex --token $TOKEN -o $ORG

```

Export only those APIs deployed to a particular environment:

```
$ node ./bulkExport.js --token $TOKEN -o $ORG -v -e prod

```

You can use the `-R` option with the `-e` option.

There is also a `-t` option, for "trial", or "dryrun". Rather than exporting, it simply prints out what it would export. Using this you can test out the tool before doing the exports.

You can also export sharedflows, rather than APIs.

Check the help on the tool for more information on options.


## Using an alternative Management server

By default, the tool uses "https://api.enterprise.apigee.com" as the
base URL for the Apigee management server. If you have a customer-managed
Apigee Edge (aka OPDK), you will have a different base URL for the management
server. You can override the default like this:

```
$ node bulkExport.js --mgmtserver=https://my-mgmt-server.com \
   --username={{YOURAPIGEEEDGEEMAILADDRESS}} --password={{YOURAPIGEEDGEPASSWORD}} \
   --org={{YOURAPIGEEEDGEORGNAME}} -v

```

## How does it work?

It's pretty simple.  This nodejs script uses the apigee-edge-js
node module to enumerate proxies and export them.


# License

This material is Copyright 2015,2016 Apigee Corporation. Copyright 2017-2022 Google LLC.
and is licensed under the Apache 2.0 license. See the [LICENSE](../LICENSE) file.
