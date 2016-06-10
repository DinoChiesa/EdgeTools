# loader for Baas Hospitality data

This project lets you load data into usergrid (also known as "BaaS"), or remove data from BaaS. Any data.

There are two scripts:
* loader.js - loads data into usergrid
* deleteAllItems.js -deletes the data from a collection when you are finished with it.

In particular, these tools are handy for loading the hospitality data into any Usergrid organization and application. They could also be used for other data and other collections. 




## Before you run

You must use `npm install` to get the necessary pre-requisites.

## The data

Loading data always loads from the data directory.
In this repo, there is a hotels.json file. Running the loader will thus create a hotels collection and fill it with data from the data/hotels.json file .


## Configuring 

For either script there are some data you must supply.

* organization
* application
* Usergrid/BaaS endpoint (Defaults to https://api.usergrid.com)
* credentials - either user creds or client creds for the app

Also, if running the deleteAllItems, you must specify the collection name from which to delete all items. 

You can specify all of these things as command-line options. Or, you can specify them in a configuration file, like so: 

Example commmand, specifying all options, using client credentials:

```node ./deleteAllItems.js -o amer-partner7 -a myapp1 -i YYYAZZJDJD -s YkjakajksjksE8 \ 
     -v -e https://amer-apibaas-prod.apigee.net/appservices/ -C hotels```

Example command specifying a configuration file:
```node ./deleteAllItems.js -c config/real-config.json```

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



Or, for user credentials, with the Usergrid API endpoint (which is the default):

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

Notice, no URI property there.  To authenticate with user credentials,  you must have created a user in your Usergrid application.  Do this via the usergrid Admin UI. 



## Exporting Baas Data: Nope

There are no tools here that export data from BaaS Collections.
