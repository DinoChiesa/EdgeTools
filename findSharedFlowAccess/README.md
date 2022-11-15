# findSharedFlowAccess

Queries the policies in the proxies in an organization to determine which of them includes a FlowCallout policy.
Without options all proxies and revisions are searched and SharedFlow usage is reported.

Filtering the search:

* -s cors-v1 (search for a specific SharedFlow by name)
* -d (only search deployed proxies)
* -e (only search deployed proxies in an environment, requires -d)

The script displays the list of URLs for policies that match.

## Examples:

Find all FlowCallout policies:

```
node ./findSharedFlowAccess.js -n -o $ORG
 ...
[2020-May-26 15:24:13] matching SharedFlow policies: ["apis/pingstatus-v1/revisions/1/policies/FC-cors","apis/pingstatus-v1/revisions/2/policies/FC-cors","apis/pingstatus-v1/revisions/2/policies/FC-security","apis/pingstatus-v2/revisions/1/policies/FC-cors","apis/pingstatus-v2/revisions/2/policies/FC-cors-v2"]
```

Find all FlowCallout policies that access "cors-v1":

```
node ./findSharedFlowAccess.js -n -o $ORG -s cors-v1
 ...
[2020-May-26 15:21:58] matching SharedFlow policies: ["apis/pingstatus-v1/revisions/1/policies/FC-cors","apis/pingstatus-v1/revisions/2/policies/FC-cors","apis/pingstatus-v2/revisions/1/policies/FC-cors"]
```

Find all FlowCallout policies in proxies that are deployed:

```
node ./findSharedFlowAccess.js -n -o $ORG -d
 ...
[2020-May-26 15:22:35] matching SharedFlow policies: ["apis/pingstatus-v1/revisions/2/policies/FC-cors","apis/pingstatus-v1/revisions/2/policies/FC-security","apis/pingstatus-v2/revisions/1/policies/FC-cors"]
```

Find all FlowCallout policies in proxies that are deployed in an environment:

```
node ./findSharedFlowAccess.js -n -o $ORG -d -e test
 ...
[2020-May-26 15:26:42] matching SharedFlow policies: ["apis/pingstatus-v2/revisions/1/policies/FC-cors"]
```

Find all FlowCallout policies that access "cors-v1" in proxies deployed in an environment:

```
node ./findSharedFlowAccess.js -n -o $ORG -d -e prod -s cors-v1
 ...
[2020-May-26 15:28:22] matching SharedFlow policies: ["apis/pingstatus-v1/revisions/2/policies/FC-cors"]
```
