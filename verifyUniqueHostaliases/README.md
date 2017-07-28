# verifyUniqueHostaliases.js

Queries all vhosts in all provided orgs to check for hostalias uniqueness. The idea is we want to make sure a given hostalias is present in exactly one vhost. k=

## Example:

```
node ./verifyUniqueHostaliases.js -n ORGNAME1 ORGNAME2 -u dchiesa@google.com
...
{
  "map": {
    "demo-oapi-dev-cicd.apigee.net:443": "o/demo-oapi-dev/e/cicd/virtualhosts/secure",
    "test10.myapi.example.com:443": "o/demo-oapi-dev/e/cicd/virtualhosts/secure",
    "demo-oapi-dev-develop.apigee.net:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test1.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test2.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test3.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test4.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test5.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test6.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test7.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test8.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "test9.myapi.example.com:443": "o/demo-oapi-dev/e/develop/virtualhosts/secure",
    "demo-integration-oapi-stage.apigee.net:443": "o/demo-integration/e/oapi-stage/virtualhosts/secure",
    "demo-integration-udp-stable.apigee.net:80": "o/demo-integration/e/udp-stable/virtualhosts/default",
    "demo-integration-udp-stable.apigee.net:443": "o/demo-integration/e/udp-stable/virtualhosts/secure",
    "demo-integration-oapi-stable.apigee.net:443": "o/demo-integration/e/oapi-stable/virtualhosts/secure",
    "demo-integration-cdx-stable.apigee.net:80": "o/demo-integration/e/cdx-stable/virtualhosts/default",
    "demo-integration-cdx-stable.apigee.net:443": "o/demo-integration/e/cdx-stable/virtualhosts/secure",
    "demo-integration-ucp-stable.apigee.net:80": "o/demo-integration/e/ucp-stable/virtualhosts/default",
    "demo-integration-ucp-stable.apigee.net:443": "o/demo-integration/e/ucp-stable/virtualhosts/secure",
    "demo-integration-oapi-master.apigee.net:443": "o/demo-integration/e/oapi-master/virtualhosts/secure",
    "test11.myapi.example.com:443": "o/demo-integration/e/oapi-master/virtualhosts/secure",
    "demo-integration-udp-master.apigee.net:80": "o/demo-integration/e/udp-master/virtualhosts/default",
    "demo-integration-udp-master.apigee.net:443": "o/demo-integration/e/udp-master/virtualhosts/secure",
    "demo-integration-cdx-master.apigee.net:80": "o/demo-integration/e/cdx-master/virtualhosts/default",
    "demo-integration-cdx-master.apigee.net:443": "o/demo-integration/e/cdx-master/virtualhosts/secure",
    "demo-integration-ucp-master.apigee.net:80": "o/demo-integration/e/ucp-master/virtualhosts/default",
    "demo-integration-ucp-master.apigee.net:443": "o/demo-integration/e/ucp-master/virtualhosts/secure",
    "demo-nonprod-main.apigee.net:80": "o/demo-nonprod/e/main/virtualhosts/default",
    "demo-nonprod-main.apigee.net:443": "o/demo-nonprod/e/main/virtualhosts/secure",
    "demo-nonprod-load.apigee.net:80": "o/demo-nonprod/e/load/virtualhosts/default",
    "demo-nonprod-load.apigee.net:443": "o/demo-nonprod/e/load/virtualhosts/secure",
    "demo-nonprod-stage.apigee.net:80": "o/demo-nonprod/e/stage/virtualhosts/default",
    "demo-nonprod-stage.apigee.net:443": "o/demo-nonprod/e/stage/virtualhosts/secure",
    "demo-cdx-dev-develop.apigee.net:80": "o/demo-cdx-dev/e/develop/virtualhosts/default",
    "demo-cdx-dev-develop.apigee.net:443": "o/demo-cdx-dev/e/develop/virtualhosts/secure",
    "demo-eapi-dev-develop.apigee.net:80": "o/demo-eapi-dev/e/develop/virtualhosts/default",
    "demo-eapi-dev-develop.apigee.net:443": "o/demo-eapi-dev/e/develop/virtualhosts/secure",
    "demo-production-eapi-prod.apigee.net:80": "o/demo-production/e/eapi-prod/virtualhosts/default",
    "demo-production-eapi-prod.apigee.net:443": "o/demo-production/e/eapi-prod/virtualhosts/secure",
    "demo-production-oapi-prod.apigee.net:443": "o/demo-production/e/oapi-prod/virtualhosts/secure",
    "oapi.example.com:443": "o/demo-production/e/oapi-prod/virtualhosts/secure",
    "demo-production-cdx-prod.apigee.net:80": "o/demo-production/e/cdx-prod/virtualhosts/default",
    "demo-production-cdx-prod.apigee.net:443": "o/demo-production/e/cdx-prod/virtualhosts/secure",
    "demo-production-ucp-prod.apigee.net:80": "o/demo-production/e/ucp-prod/virtualhosts/default",
    "demo-production-ucp-prod.apigee.net:443": "o/demo-production/e/ucp-prod/virtualhosts/secure",
    "demo-production-udp-prod.apigee.net:80": "o/demo-production/e/udp-prod/virtualhosts/default",
    "demo-production-udp-prod.apigee.net:443": "o/demo-production/e/udp-prod/virtualhosts/secure",
    "demo-ucp-dev-develop.apigee.net:80": "o/demo-ucp-dev/e/develop/virtualhosts/default",
    "demo-ucp-dev-develop.apigee.net:443": "o/demo-ucp-dev/e/develop/virtualhosts/secure",
    "demo-udp-dev-develop.apigee.net:80": "o/demo-udp-dev/e/develop/virtualhosts/default",
    "demo-udp-dev-develop.apigee.net:443": "o/demo-udp-dev/e/develop/virtualhosts/secure"
  },
  "errors": {}
}

```

If there are any duplicate hostaliases, they will be listed in the errors property.
You can example the map property to determine the org/env/vhost tuple for which the hostalias has been defined.

