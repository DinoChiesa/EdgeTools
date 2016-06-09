# diffApiproxyRevisions

```
diffApiproxyRevisions.sh: 
  Produces a diff of two revisions of an API proxy in Apigee Edge.
  Uses the curl and diff utilities.
usage: 
 diffApiproxyRevisions.sh [options] 
options: 
  -o org    the org to use.
  -u user   Edge admin user for the Admin API calls.
  -n        use .netrc to retrieve credentials (in lieu of -u)
  -m url    the base url for the mgmt server.
  -a proxy  the apiproxy to use. should already be present in the org.
  -R n      the revision number. Specify this twice.
  -q        quiet; decrease verbosity by 1
  -v        verbose; increase verbosity by 1

Current parameter values:
  mgmt api url: https://api.enterprise.apigee.com
     verbosity: 1
```

## Example output:

```
$ ./diffApiproxyRevisions.sh -o nordstrom-eval1 -a bluegreen -R 9 -R 11 -n

This script downloads two API proxy revisions and performs a diff on them.
==============================================================================


  checking org nordstrom-eval1...
curl -X GET https://api.enterprise.apigee.com/v1/o/nordstrom-eval1
==> 200
9
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  5910  100  5910    0     0    450      0  0:00:13  0:00:13 --:--:--  1522
Archive:  bluegreen-r9.zip
  inflating: bluegreen-r9/apiproxy/bluegreen.xml  
  inflating: bluegreen-r9/apiproxy/policies/RF-BadRequest.xml  
  inflating: bluegreen-r9/apiproxy/policies/JS-SelectTarget.xml  
  inflating: bluegreen-r9/apiproxy/policies/AM-Response.xml  
  inflating: bluegreen-r9/apiproxy/policies/SC-GetDesiredWeights.xml  
  inflating: bluegreen-r9/apiproxy/policies/AM-CleanResponseHeaders.xml  
  inflating: bluegreen-r9/apiproxy/policies/CacheLookup-TargetWeights.xml  
  inflating: bluegreen-r9/apiproxy/policies/CacheInsert-TargetWeights.xml  
  inflating: bluegreen-r9/apiproxy/proxies/default.xml  
  inflating: bluegreen-r9/apiproxy/resources/jsc/weightedRandomSelector.js  
  inflating: bluegreen-r9/apiproxy/resources/jsc/selectTarget.js  
11
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  5910  100  5910    0     0    468      0  0:00:12  0:00:12 --:--:--  1349
Archive:  bluegreen-r11.zip
  inflating: bluegreen-r11/apiproxy/bluegreen.xml  
  inflating: bluegreen-r11/apiproxy/policies/RF-BadRequest.xml  
  inflating: bluegreen-r11/apiproxy/policies/JS-SelectTarget.xml  
  inflating: bluegreen-r11/apiproxy/policies/AM-Response.xml  
  inflating: bluegreen-r11/apiproxy/policies/SC-GetDesiredWeights.xml  
  inflating: bluegreen-r11/apiproxy/policies/AM-CleanResponseHeaders.xml  
  inflating: bluegreen-r11/apiproxy/policies/CacheLookup-TargetWeights.xml  
  inflating: bluegreen-r11/apiproxy/policies/CacheInsert-TargetWeights.xml  
  inflating: bluegreen-r11/apiproxy/proxies/default.xml  
  inflating: bluegreen-r11/apiproxy/resources/jsc/weightedRandomSelector.js  
  inflating: bluegreen-r11/apiproxy/resources/jsc/selectTarget.js  
diff -r bluegreen-r9/apiproxy/bluegreen.xml bluegreen-r11/apiproxy/bluegreen.xml
2c2
< <APIProxy revision="9" name="bluegreen">
---
> <APIProxy revision="11" name="bluegreen">
4c4
<     <CreatedAt>1465414312417</CreatedAt>
---
>     <CreatedAt>1465423969600</CreatedAt>
8c8
<     <LastModifiedAt>1465414312417</LastModifiedAt>
---
>     <LastModifiedAt>1465423969600</LastModifiedAt>
diff -r bluegreen-r9/apiproxy/policies/CacheInsert-TargetWeights.xml bluegreen-r11/apiproxy/policies/CacheInsert-TargetWeights.xml
10c10
<     <TimeoutInSec>30</TimeoutInSec>
---
>     <TimeoutInSec>10</TimeoutInSec>
```


## License

This script is licensed under the Apache 2.0 source license. See the [LICENSE](../LICENSE) file accompanying this script.
