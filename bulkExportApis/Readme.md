# How to use this tool ?

Requirements :

* Latest Node.JS installed on your machine
* GIT CLI installed on your machine

Installation :

$> git clone https://github.com/DinoChiesa/EdgeTools.git

$> cd EdgeTools

$> cd bulkExportApis

$> npm install

How to bulk download proxies ?

Once installed run below command from "bulkExportApis" directory.

$> node bulkExportApis.js --mgmtserver=https://api.enterprise.apigee.com --username={{YOURAPIGEEEDGEEMAILADDRESS}} --password={{YOURAPIGEEDGEPASSWORD}} --org={{YOURAPIGEEEDGEORGNAME}} -v
