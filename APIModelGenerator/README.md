# Generate API Model from API Proxies

This is intended for generating API Model from an API proxy that exists in Edge.


## Usage
Edit the config.js with your org data and creds

```
npm install
node updatedoc.js
```

## API Model Integration

1. This parses all the files in the API Proxy
2. Works for all query , header, path params used in the proxy
3. Adds Method body for POST and PUT
4. Adds proxy Name as the tag for WADL resources. So, all resources within a proxy are grouped together

This is how it looks for Cosafinity,
https://api.enterprise.apigee.com/v1/o/cosafinity/apimodels/model/revisions/latest/doc


## How it works

It takes the API Product, Org Name, API Model Name as a Input [among other obvious things]

1. It reads the API product
2. Retrieves API Proxies assigned for this API Product [Added in the API Product]
For eg,

```
{
    "apiResources": [],
    "approvalType": "auto",
    "attributes": [
        {
            "name": "access",
            "value": "public"
        }
    ],
    "createdAt": 1398779209577,
    "createdBy": "mukundha@apigee.com",
    "description": "",
    "displayName": "Partners",
    "environments": [
        "test",
        "prod"
    ],
    "lastModifiedAt": 1399383878641,
    "lastModifiedBy": "mukundha@apigee.com",
    "name": "Partners",
    "proxies": [
        "payment-monetization"
    ],
    "scopes": [
        ""
    ]
}
```

All Proxies in the 'proxies' array are considered for Model Generation

3. Extracts the API Proxies and generates the WADL
4. Uploads the WADL to a new revision for the API Model specified

## Integration with Smart Docs
This does not refresh the SmartDocs module in portal. Refresh in portal is still manual.

## Results
After running the script, you should expect the Model updated with new changes


