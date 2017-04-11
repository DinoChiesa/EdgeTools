# findJavaPolicies

Queries all the policies in all the proxies in an organization to determine which of them includes a JavaCallout policy. Or, queries all proxies to determine which of them includes a specific Jar resource, or a resource that matches a specific regexp.

The script displays the list of URLs for policies, or proxies, that match.

## Examples:

Find all JavaCallout policies:

```
 node ./findJavaPolicies.js -n -o ORGNAME
 ...
 [2017-Mar-27 12:39:30] matching Java policies: ["apis/stackdriver-1/revisions/30/policies/KVM-Get-Stackdriver-PrivateKey","apis/stackdriver-1/revisions/30/policies/KVM-Get-Stackdriver-Settings","apis/stackdriver-1/revisions/31/policies/KVM-Get-Stackdriver-PrivateKey","apis/stackdriver-1/revisions/31/policies/KVM-Get-Stackdriver-Settings"]
```


Find all proxies that include a specific JAR resource:

```
 node ./findJavaPolicies.js -n -o ORGNAME -J guava-18.0.jar 
 ...
[2017-Apr-10 18:14:33] matching Java proxies: ["apis/pstest-java-props-r1/revisions/1","apis/stackdriver-1/revisions/30","apis/stackdriver-1/revisions/31","apis/stackdriver-1/revisions/32","apis/stackdriver-1/revisions/33","apis/stackdriver-1/revisions/34","apis/stackdriver-1/revisions/35","apis/stackdriver-1/revisions/36","apis/stackdriver-1/revisions/37","apis/stackdriver-1/revisions/38","apis/jwt-verification/revisions/1","apis/jwt-verification/revisions/2","apis/jwt-verification/revisions/3","apis/jwt-verification/revisions/4","apis/jwt_signed/revisions/1","apis/jwt_signed/revisions/2","apis/jwt_signed/revisions/3","apis/jwt_signed/revisions/4","apis/java-props/revisions/1","apis/devjam3-oauth2-oidc/revisions/1","apis/newproxy/revisions/1","apis/apitechforum/revisions/26","apis/apitechforum/revisions/27","apis/apitechforum/revisions/28","apis/apitechforum/revisions/29","apis/apitechforum/revisions/30","apis/apitechforum/revisions/31","apis/redbox/revisions/1","apis/redbox/revisions/10","apis/redbox/revisions/12","apis/redbox/revisions/13","apis/rfc7523/revisions/1","apis/rfc7523/revisions/2"]

```


Find all proxies that include a JAR resource matching a specific regex:

```
 node ./findJavaPolicies.js -n -o ORGNAME -J '(guava-18.0\.jar|json-smart-1.3\.jar)' -R 
 ...
[2017-Apr-10 18:14:33] matching Java proxies: ["apis/pstest-java-props-r1/revisions/1","apis/stackdriver-1/revisions/30","apis/stackdriver-1/revisions/31","apis/stackdriver-1/revisions/32","apis/stackdriver-1/revisions/33","apis/stackdriver-1/revisions/34","apis/stackdriver-1/revisions/35","apis/stackdriver-1/revisions/36","apis/stackdriver-1/revisions/37","apis/stackdriver-1/revisions/38","apis/jwt-verification/revisions/1","apis/jwt-verification/revisions/2","apis/jwt-verification/revisions/3","apis/jwt-verification/revisions/4","apis/jwt_signed/revisions/1","apis/jwt_signed/revisions/2","apis/jwt_signed/revisions/3","apis/jwt_signed/revisions/4","apis/java-props/revisions/1","apis/devjam3-oauth2-oidc/revisions/1","apis/newproxy/revisions/1","apis/apitechforum/revisions/26","apis/apitechforum/revisions/27","apis/apitechforum/revisions/28","apis/apitechforum/revisions/29","apis/apitechforum/revisions/30","apis/apitechforum/revisions/31","apis/redbox/revisions/1","apis/redbox/revisions/10","apis/redbox/revisions/12","apis/redbox/revisions/13","apis/rfc7523/revisions/1","apis/rfc7523/revisions/2"]

```





