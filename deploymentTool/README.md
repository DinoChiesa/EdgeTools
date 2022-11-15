# deploymentTool for Apigee

This is an interactive Command-line tool that allows you to deploy or undeploy a series of API proxies.

The proxies must already be imported into the organization in order to be deployed or undeployed using this tool.

It works with Edge or X/hybrid. If you use Edge, you need to use an OAuth token
to authenticate, which you can get via the Apigee `get_token` command.

## Instructions

You need npm and node to use this tool.

To get set up:
```
npm install
node ./deploymentTool.js
```

To run:
```
node ./deploymentTool.js
```


## Example session

```
$ node ./deploymentTool.js
Apigee interactive undeployer tool, version: 20221115-1353
Node.js v16.17.0

? Edge or X/hybrid? X/hybrid
? organization name? roaming-llama-1
? token? ya29.a0AeTM1icC...Ew0174
[2022-Nov-15 15:50:12] connect: {"orgname":"roaming-llama-1","loginBaseUrl":"https://login.apigee.com","user":null,"mgmtServer":"https://apigee.googleapis.com"}
[2022-Nov-15 15:50:12] get environments
[2022-Nov-15 15:50:12] GET https://apigee.googleapis.com/v1/organizations/roaming-llama-1/environments
[2022-Nov-15 15:50:12] status: 200
? environment eval
? action deploy
[2022-Nov-15 15:50:18] GET https://apigee.googleapis.com/v1/organizations/roaming-llama-1/environments/eval/deployments
[2022-Nov-15 15:50:18] status: 200
[2022-Nov-15 15:50:18] GET https://apigee.googleapis.com/v1/organizations/roaming-llama-1/apis
[2022-Nov-15 15:50:18] status: 200
? Select regex-protect-uri
deploying regex-protect-uri
[2022-Nov-15 15:50:22] Get revisions for apiproxy regex-protect-uri
[2022-Nov-15 15:50:22] GET https://apigee.googleapis.com/v1/organizations/roaming-llama-1/apis/regex-protect-uri/revisions
[2022-Nov-15 15:50:22] status: 200
[2022-Nov-15 15:50:22] Revisions: ["1"]
[2022-Nov-15 15:50:22] deploy apiproxy regex-protect-uri r1 to env:eval
[2022-Nov-15 15:50:22] POST https://apigee.googleapis.com/v1/organizations/roaming-llama-1/environments/eval/apis/regex-protect-uri/revisions/1/deployments
                       override=true
[2022-Nov-15 15:50:23] status: 200
? Select validate-soapui-signature
deploying validate-soapui-signature
[2022-Nov-15 15:50:31] Get revisions for apiproxy validate-soapui-signature
[2022-Nov-15 15:50:31] GET https://apigee.googleapis.com/v1/organizations/roaming-llama-1/apis/validate-soapui-signature/revisions
[2022-Nov-15 15:50:31] status: 200
[2022-Nov-15 15:50:31] Revisions: ["2","3"]
[2022-Nov-15 15:50:31] deploy apiproxy validate-soapui-signature r3 to env:eval
[2022-Nov-15 15:50:31] POST https://apigee.googleapis.com/v1/organizations/roaming-llama-1/environments/eval/apis/validate-soapui-signature/revisions/3/deployments
                       override=true
[2022-Nov-15 15:50:32] status: 200
? Select -QUIT-

```
