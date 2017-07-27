# How to use this tool ?

This tool exports all of the API Proxies that are loaded into an organization.
It results in a single ZIP file being downloaded for each revision of each api proxy.
The names of the zip files are based on the API name and the revision number.


## Requirements 

* Latest Node.JS installed on your machine
* GIT CLI installed on your machine

## Installation :

```
$ git clone https://github.com/DinoChiesa/EdgeTools.git

$ cd EdgeTools

$ cd bulkExportApis

$ npm install
```

## Usage Examples

How to download all proxies, once the tool is installed? 
Once installed run below command from "bulkExportApis" directory.

```
$ node bulkExportApis.js --username={{YOURAPIGEEEDGEEMAILADDRESS}} --password={{YOURAPIGEEDGEPASSWORD}} --org={{YOURAPIGEEEDGEORGNAME}} -v

```

If you store credentials in .netrc, the tool can use them.  Do it like so:

```
$ node bulkExportApis.js -n -org=ORGNAME -v

```

You can export only those APIs with names matching a specific regex.  Like this: 

```
$ node bulkExportApis.js -n -org=ORGNAME -v -R ytd\*

```

And you can export only the latest revision of each API with -L.  These options compose; you can use -R and -L together. 



By default, the tool uses "https://api.enterprise.apigee.com" as the
base URL for the Edge management server. If you have a customer-managed
Apigee Edge, you will have a different base URL for the management
server. You can override the default like this:

```
$ node bulkExportApis.js --mgmtserver=https://my-mgmt-server.com \
   --username={{YOURAPIGEEEDGEEMAILADDRESS}} --password={{YOURAPIGEEDGEPASSWORD}} \
   --org={{YOURAPIGEEEDGEORGNAME}} -v

```

## How does it work?

It's pretty simple.  This nodejs script uses the apigee-edge-js
node module to enumerate proxies and export them. 


# License

This material is Copyright 2015,2016 Apigee Corporation. Copyright 2017 Google Inc.
and is licensed under the Apache 2.0 license. See the [LICENSE](../LICENSE) file. 
