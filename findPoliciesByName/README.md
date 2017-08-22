# findPoliciesByName

Queries all the policies in all the proxies and sharedflows in an organization to determine which of them includes policies matching a given regexp. 

The script displays the list of URLs for policies that match.

## Examples:

Find all policies within either proxies or sharedflows in an org with a name like JS-D.+

```
 node ./findPoliciesByName.js -o cap500 -n -R JS-D.+ 
 ...
 [2017-Aug-22 11:12:52] occurrences within proxies: ["apis/dynamic-target-path/revisions/1/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/2/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/3/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/4/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/5/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/6/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/7/policies/JS-DynamicallySelectTargetPath"]
 [2017-Aug-22 11:11:55] occurrences within sharedflows: ["sharedflows/apigee-edge-js-test-1493918758848hmouitg07lh3/revisions/1/policies/JS-DeriveKeyId","sharedflows/apigee-edge-js-test-149391885899045lamjimzmf5/revisions/1/policies/JS-DeriveKeyId","sharedflows/apigee-edge-js-test-1493918800032yh69dkf4xgmy/revisions/1/policies/JS-DeriveKeyId"]


```

Find all policies within proxies in an org with a name like JS-D.+

```
 node ./findPoliciesByName.js -o cap500 -n -R JS-D.+ -P
 ...
 [2017-Aug-22 11:12:52] occurrences within proxies: ["apis/dynamic-target-path/revisions/1/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/2/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/3/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/4/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/5/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/6/policies/JS-DynamicallySelectTargetPath","apis/dynamic-target-path/revisions/7/policies/JS-DynamicallySelectTargetPath"]

```


Find all policies within sharedflows in an org with  name like JS-D.+

```
 node ./findPoliciesByName.js -o cap500 -n -R JS-D.+ -S
 ...
[2017-Aug-22 11:11:55] occurrences within sharedflows: ["sharedflows/apigee-edge-js-test-1493918758848hmouitg07lh3/revisions/1/policies/JS-DeriveKeyId","sharedflows/apigee-edge-js-test-149391885899045lamjimzmf5/revisions/1/policies/JS-DeriveKeyId","sharedflows/apigee-edge-js-test-1493918800032yh69dkf4xgmy/revisions/1/policies/JS-DeriveKeyId"]

```







