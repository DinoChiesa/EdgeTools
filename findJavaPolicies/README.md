# findJavaPolicies

Queries all the policies in all the proxies in an organization to determine
which of them includes a JavaCallout policy. Or, queries all proxies to
determine which of them includes a specific Jar resource, or a resource that
matches a specific regexp.

The script displays the list of proxies that match.

## Examples:

Find all JavaCallout policies for proies that begin with the letter p:

```
node ./findJavaPolicies.js -v --apigeex --token $TOKEN -o my-org  --proxyregex '^x.+$'
...
[
  {
    "name": "xmlcipher",
    "revision": 3,
    "flowCalloutPolicies": [
      "Java-XmlCipher-Decrypt.xml",
      "Java-XmlCipher-Encrypt-WithGeneratedKey.xml",
      "Java-XmlCipher-Encrypt-WithProvidedKey.xml"
    ]
  },
  {
    "name": "xop-handler",
    "revision": 2,
    "flowCalloutPolicies": [
      "Java-ProcessXop-1.xml",
      "Java-ProcessXop-2.xml",
      "Java-ProcessXop-3.xml"
    ]
  }
]

```

