# loader for Baas Hospitality data

This project lets you load data into usergrid (also known as "BaaS"), or export data from BaaS, or remove data from BaaS. Any data.

There are three scripts:
* loader.js - loads data into BaaS
* exportAllItems.js - export data from BaaS
* deleteAllItems.js - deletes the data from a collection. 

In particular, these tools are handy for loading the hospitality data into any Usergrid organization and application. They could also be used for other data and other collections. 


## Before you run

You must use `npm install` to get the necessary pre-requisites.


## Points of Interest

The loader.js script implements a monkeypatch of the usergrid library, to insert a batchCreate method.  This allows you to create a batch of N entities at a time,
which simplifies coding significantly. For example: 

```js
function doUploadWork (ugClient, collectionName, data, cb) {
  toBatches(data) // produce an array of arrays, each inner array one batch size (100-ish?)
    .reduce(function(promise, batch) {
      return promise.then(function() {
        var d = q.defer();
        ugClient.batchCreate(collectionName, batch, function (e, entities) {
           d.resolve({});
        });
        return d.promise;
      });
    }, q({}))
    .then(function () {
      cb(null);
    }, function(e) {
      cb(e);
    });
}

```


## Where's the data?

The loader.js script always looks for data to load, in the data directory.
In this repo, there is a hotels.json file there. Running the loader.js will thus create a hotels collection in the BaaS org you specify, and will fill it with data from the data/hotels.json file .

You could insert your own data there to load *that*. For example, a typical workflow mighrt be:

# use exportAllItems.js to export data from org1 into the data dir
# use the loader.js to to import that data into org2


## Configuring 

For any of the scripts there are some data you must supply.

* organization
* application
* Usergrid/BaaS endpoint (defaults to https://apibaas-trial.apigee.net ; this previously defaulted to https://api.usergrid.com)
* credentials - either user creds or client creds for the app

Also, if running the deleteAllItems, you must specify the collection name from which to delete all items. 

You can specify all of these things as command-line options. Or, you can specify them in a configuration file, like so: 

Example help:
```sh
Usage: node deleteAllItems.js

  -c, --config=ARG        the configuration json file, which contains Usergrid/Baas org, app, and credentials
  -o, --org=ARG           the Usergrid/BaaS organization.
  -a, --app=ARG           the Usergrid/BaaS application.
  -C, --collection=ARG    the Usergrid/BaaS collection from which to remove all items.
  -u, --username=ARG      app user with permissions to create collections. (only if not using client creds!)
  -p, --password=ARG      password for the app user.
  -i, --clientid=ARG      clientid for the Usergrid/Baas app. (only if not using user creds!)
  -s, --clientsecret=ARG  clientsecret for the clientid.
  -e, --endpoint=ARG      the BaaS endpoint (if not api.usergrid.com)
  -v, --verbose           
  -V, --superverbose      
  -h, --help              
```

Example commmand, specifying all necessary options, using client credentials:

```sh
node ./deleteAllItems.js -o amer-partner7 -a myapp1 -i YYYAZZJDJD -s YkjakajksjksE8 \ 
     -v -e https://amer-apibaas-prod.apigee.net/appservices/ -C hotels
```

Example command specifying a configuration file:
```sh
node ./deleteAllItems.js -c config/real-config.json
```

The configuration file must have contents like so:

```json
{
  "org": "amer-partner7",
  "app": "myapp1",
  "clientid": "YXA677w8w", 
  "clientsecret": "YYZskjsksjs88", 
  "URI": "https://amer-apibaas-prod.apigee.net/appservices",
  "collection" : "hotels", 
  "verbose" : true
}
```

The URI property specifies the BaaS endpoint (rather than https://api.usergrid.com). 
You can find the client id and secret in the Usergrid/BaaS Admin UI for your application. 



Or, for user credentials, with the BaaS trial API endpoint (https://apibaas-trial.apigee.net , which is the default):

```json
{
  "org": "cheeso",
  "app": "your-application-name",
  "username" : "JoePavelski1",
  "password" : "VerySecret!!",
  "collection" : "hotels", 
  "verbose" : true
}
```

Notice, no URI property there.  To authenticate with user credentials,  you must have created a user in your API BaaS application.  Do this via the API BaaS Admin UI. 



## Exporting Baas Data

The exportAllItems.js. tool will export dat from a single collection.
It's naive: it does not export connections or relationships. 

Example command specifying a configuration file:

```sh
node ./exportAllItems.js -c config/real-config.json -f my-collection-export.json
```

You could use this coupled with the loader to migrate a collection of data from one BaaS app to another. 


## Loading Data 

The loader.js tool reads all the JSON files in the data directory and
loads them into the specified API BaaS application.


```sh
node ./loader.js -o dino -a workshop -i YXsjhsiXoFUyEeaVzhg -s YXA653alN5kddd5k 
```

or,

```sh
node ./loader.js -c config/real-config.json
```

