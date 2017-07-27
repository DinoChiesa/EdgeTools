# findKvmAccess

Queries all the policies in all the proxies in an organization to determine which of them includes a KeyValueMapOperations policy, optionally for a specific mapIdentifier.


The script displays the list of URLs for policies that match.

## Examples:

Find all KVM policies:

```
 node ./findKvmAccess.js -n -o ORGNAME
 ...
 [2017-Mar-27 12:39:30] matching KVM policies: ["apis/stackdriver-1/revisions/30/policies/KVM-Get-Stackdriver-PrivateKey","apis/stackdriver-1/revisions/30/policies/KVM-Get-Stackdriver-Settings","apis/stackdriver-1/revisions/31/policies/KVM-Get-Stackdriver-PrivateKey","apis/stackdriver-1/revisions/31/policies/KVM-Get-Stackdriver-Settings"]
```

Find all KVM policies that access map1:

```
 node ./findKvmAccess.js -n -o ORGNAME -M map1
 ...
 [2017-Mar-27 12:39:30] matching KVM policies: [... ]
```

Find all KVM policies that access map1 in scope environment:

```
 node ./findKvmAccess.js -n -o ORGNAME -M map1 -S environment
 ...
 [2017-Mar-27 12:39:30] matching KVM policies: [... ]
```


