# verifyUniqueHostaliases.js

Queries all vhosts in all provided orgs to check for hostalias uniqueness. The idea is we want to make sure a given hostalias is present in exactly one vhost. k=

## Example:

```
 node ./verifyUniqueHostaliases.js -n ORGNAME1 ORGNAME2 -u dchiesa@google.com
 ...

```

