#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# Created: <Mon Dec  5 12:23:02 2016>
# Last Updated: <2016-December-12 17:28:30>
#

verbosity=2
orgname=""
certfile=""
keyfile=""
keystore=""
keystoreref=""
tmpksdir=""
privkeypass=""
TIMESTAMP=""
envname=test
defaultmgmtserver="https://api.enterprise.apigee.com"
credentials=""
netrccreds=0
TAB=$'\t'

function usage() {
  local CMD=`basename $0`
  echo "$CMD: "
  echo "  Creates a new keystore in Edge and loads it with a private key and cert."
  echo "  Useful for updating expired certs used in vhosts or targetservers."
  echo "  Uses the curl utility, and the jar utility."
  echo "usage: "
  echo "  $CMD [options] "
  echo "options: "
  echo "  -m url    optional. the base url for the mgmt server."
  echo "  -o org    required. the org to use."
  echo "  -e env    required. the environment in which to create the keystore."
  echo "  -u creds  optional. http basic authn credentials for the API calls."
  echo "  -n        optional. tells curl to use .netrc to retrieve credentials. use in lieu of -u"
  echo "  -K name   optional. keystore name. Defaults to a generated name that includes a timestamp."
  echo "  -c file   required. cert file."
  echo "  -k file   required. private key file."
  echo "  -t tag    optional. tag name to use as a part of the names for keystore, keyalias, and cert."
  echo "  -K name   optional. Name for the keystore. Overrides the generated name using the tag from -t."
  echo "  -R ref    required. Name for the keystore reference."
  echo "  -p pwd    optional. password for the private key file, if needed."
  echo "  -v        optional. verbose; increase verbosity by 1"
  echo
  echo "Current parameter values:"
  echo "  mgmt api url: $defaultmgmtserver"
  echo "     verbosity: $verbosity"
  echo "   environment: $envname"
  echo
  exit 1
}


function gen_timestamp() {
    [[ -z "$TIMESTAMP" ]] && TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
    echo ${TIMESTAMP}
}


## function MYCURL
## Print the curl command, omitting sensitive parameters, then run it.
## There are side effects:
## 1. puts curl output into file named ${CURL_OUT}. If the CURL_OUT
##    env var is not set prior to calling this function, it is created
##    and the name of a tmp file in /tmp is placed there.
## 2. puts curl http_status into variable CURL_RC
function MYCURL() {
  [[ -z "${CURL_OUT}" ]] && CURL_OUT=`mktemp /tmp/apigee-edge-provision-demo.curl.out.XXXXXX`
  [[ -f "${CURL_OUT}" ]] && rm ${CURL_OUT}
  [[ $verbosity -gt 0 && $quiet_curl -ne 1 ]] && echo "curl $@"

  # run the curl command
  CURL_RC=`curl $credentials -s -w "%{http_code}" -o "${CURL_OUT}" "$@"`
  [[ $verbosity -gt 0 ]] && echo "==> ${CURL_RC}"
}

function CleanUp() {
    [[ -f ${CURL_OUT} ]] && rm -rf ${CURL_OUT}
    [[ ! -z "${tmpksdir}" && -d "${tmpksdir}" ]] && rm -rf "${tmpksdir}"
}

function echoerror() { echo "$@" 1>&2; }

function choose_mgmtserver() {
  local name
  echo
  read -p "  Which mgmt server (${defaultmgmtserver}) :: " name
  name="${name:-$defaultmgmtserver}"
  mgmtserver=$name
  echo "  mgmt server = ${mgmtserver}"
}


function choose_credentials() {
  local username password

  read -p "username for Edge org ${orgname} at ${mgmtserver} ? (blank to use .netrc): " username
  echo
  if [[ "$username" = "" ]] ; then  
    credentials="-n"
  else
    echo -n "Org Admin Password: "
    read -s password
    echo
    credentials="-u ${username}:${password}"
  fi
}

function maybe_ask_password() {
  local password
  if [[ ${credentials} =~ ":" ]]; then
    credentials="-u ${credentials}"
  else
    echo -n "password for ${credentials}?: "
    read -s password
    echo
    credentials="-u ${credentials}:${password}"
  fi
}

function check_org() {
  [[ $verbosity -gt 0 ]] && echo "checking org ${orgname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}
  if [[ ${CURL_RC} -eq 200 ]]; then
    check_org=0
  else
    check_org=1
  fi
}

function check_env() {
  [[ $verbosity -gt 0 ]] && echo "checking environment ${envname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}/e/${envname}
  if [[ ${CURL_RC} -eq 200 ]]; then
    check_env=0
  else
    check_env=1
  fi
}

function choose_org() {
  local all_done
  all_done=0
  while [ $all_done -ne 1 ]; do
      echo
      read -p "  Which org? " orgname
      check_org 
      if [ ${check_org} -ne 0 ]; then
        echo cannot read that org with the given creds.
        echo
        all_done=0
      else
        all_done=1
      fi
  done
  [[ $verbosity -gt 0 ]] && echo && echo "org = ${orgname}"
}


function choose_env() {
  local all_done
  all_done=0
  while [ $all_done -ne 1 ]; do
      echo
      read -p "  Which env? " envname
      check_env
      if [ ${check_env} -ne 0 ]; then
        echo cannot read that env with the given creds.
        echo
        all_done=0
      else
        all_done=1
      fi
  done
  [[ $verbosity -gt 0 ]] && echo && echo "env = ${envname}"
}

function random_string() {
  local rand_string
  rand_string=$(cat /dev/urandom |  LC_CTYPE=C  tr -cd '[:alnum:]' | head -c 10)
  echo ${rand_string}
}

function validateCertFile() {
    local grepout 
    if [[ ! -f ${certfile} ]]; then
        echo "that cert file cannot be verified."
        CleanUp
        exit 1
    fi
    # single square bracket to avoid pattern matching
    if [ ${certfile:(-4)} != ".pem" ]; then
        echo "you must use a pem-encoded cert file"
        CleanUp
        exit 1
    fi 
    grepout=$(grep -e "-----BEGIN CERTIFICATE-----" ${certfile})
    if [[ $? -ne 0 ]]; then
        echo "cannot find the magic words in that certfile."
        CleanUp
        exit 1
    fi
    grepout=$(grep -e "-----END CERTIFICATE-----" ${certfile})
    if [[ $? -ne 0 ]]; then
        echo "cannot find the magic words in that certfile."
        CleanUp
        exit 1
    fi
}


function validatePrivateKeyFile() {
    local grepout
    # global
    tmpksdir="/tmp/"$(random_string)
    if [[ ! -f ${keyfile} ]]; then
        echo "that key file cannot be verified."
        CleanUp
        exit 1
    fi
    
    # single square bracket to avoid pattern matching
    if [ ${keyfile:(-4)} = ".pfx" ]; then
        # this is a PKCS12 format file, which needs to be converted
        convertPfxToPem
    fi 

    # single square bracket to avoid pattern matching
    if [ ${keyfile:(-4)} != ".pem" ]; then
        echo "you must use a pem-encoded keyfile"
        CleanUp
        exit 1
    fi 

    grepout=$(grep -e "-----BEGIN " ${keyfile})
    if [[ $? -ne 0 ]]; then
        echo "cannot find the magic words in that keyfile."
        CleanUp
        exit 1
    fi
    
    grepout=$(grep -e "-----END " ${keyfile})
    if [[ $? -ne 0 ]]; then
        echo "cannot find the magic words in that keyfile."
        CleanUp
        exit 1
    fi

    grepout=$(grep -e " PRIVATE KEY-----" ${keyfile})
    if [[ $? -ne 0 ]]; then
        echo "cannot find the magic words in that keyfile."
        CleanUp
        exit 1
    fi

    grepout=$(grep -e "BEGIN ENCRYPTED PRIVATE KEY" ${keyfile})
    if [[ $? -eq 0 ]]; then
        privKeyPemIsEncrypted=1
    else
        privKeyPemIsEncrypted=0
    fi
}

function convertPfxToPem() {
    [[ $verbosity -gt 0 ]] && echo "converting the PFX to PEM..."
    # openssl pkcs12 -in client_ssl.pfx -out client_ssl.pem -clcerts
    # openssl pkcs12 -in client_ssl.pfx -out root.pem -cacerts
    # openssl pkcs12 -in client_ssl.pfx -out root.pem -nocerts
    echo "not implemented yet!"
    echo
    CleanUp
    exit 1

    # converting works like this, but we need to handle passwords correctly. 
    local pfxFile=${keyfile}
    keyfile=${pfxFile::${#pfxFile}-4}
    openssl pkcs12 -in ${pfxFile} -out ${keyfile} -nocerts
}

function createKeystoreJar() {
    [[ $verbosity -gt 0 ]] && echo "creating the keystore JAR..."
    local curdir=$(pwd) baseCertFile=$(basename ${certfile}) baseKeyFile=$(basename ${keyfile})
    
    mkdir $tmpksdir
    cd $tmpksdir
    # contents of the jar must be: 
    # META-INF/descriptor.properties
    # myCert.pem
    # myKey.pem
  
    mkdir META-INF
    cat > META-INF/descriptor.properties <<EOF
certFile=${baseCertFile}
keyFile=${baseKeyFile}
EOF
    
    pushd "$curdir" >> /dev/null
    cp ${certfile} ${tmpksdir}/${baseCertFile}
    cp ${keyfile} ${tmpksdir}/${baseKeyFile}
    popd >> /dev/null
    
    jar -cf ${keystore}.jar ${baseCertFile} ${baseKeyFile} META-INF/descriptor.properties
    if [[ $? -ne 0 ]]; then
        echo "creating the JAR failed."
        CleanUp
        exit 1
    fi
    
    if [[ $verbosity -gt 1 ]]; then
        echo "file created in ${tmpksdir}/${keystore}.jar"
        echo
        jar -tvf ${keystore}.jar
        echo 
        echo 
    fi

    cd "${curdir}"
}

function validateKeyStore() {
    [[ $verbosity -gt 0 ]] && echo "verifying that the keystore does not yet exist..."
    MYCURL -X GET ${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${keystore}
    if [ ${CURL_RC} -eq 200 ]; then
        echo CURL_RC = ${CURL_RC}
        echo error: the keystore already exists.
        echo
        cat ${CURL_OUT}
        echo
        echo
        CleanUp
        exit
    fi
}

function createKeyStore() {
    local payload
    [[ $verbosity -gt 0 ]] && echo "creating the keystore..."
    # the whitespace in this payload is just for prettifying the output in verbose mode
    payload=$'\n  {\n'
    payload+=$'    "name" : "'${keystore}$'"\n'
    payload+=$'  }\n'

    # payload=$'\n'
    # payload+=$'  <KeyStore name="'${keystore}'"/>'
    # MYCURL -X POST -H "Content-Type: text/xml" \
    #        ${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores \
    #        -d "${payload}"
    
    MYCURL -X POST -H content-type:application/json \
           ${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores \
           -d "${payload}"
    
    if [ ${CURL_RC} -ne 201 ]; then
        echo CURL_RC = ${CURL_RC}
        echo an error occurred while creating the keystore.
        echo
        cat ${CURL_OUT}
        echo
        echo
        CleanUp
        exit
    fi
    
    if [[ $verbosity -gt 1 ]]; then
      cat ${CURL_OUT}
      echo
    fi
}

function populateKeyStore() {
    [[ $verbosity -gt 0 ]] && echo "importing the JAR into the keystore..."
    local keyalias=${nametag:-keyalias-$(gen_timestamp)} privkeypass passParams="" qparams
    qparams="alias=${keyalias}"
    if [[ $privKeyPemIsEncrypted -eq 1 ]]; then
        echo 
        echo "The private key is encrypted."
        echo -n "Please provide the password for the private key: "
        read -s privkeypass
        echo
        qparams+=$'&password='
        qparams+=${privkeypass}
        passParams=$'-F "password='
        passParams+=${privkeypass}
        passParams+=$'"'
    fi
    
    # MYCURL -X POST -H "Content-Type: multipart/form-data" \
    #        -F file="@${tmpksdir}/${keystore}.jar" \
    #        -F "alias=${keyalias}" \
    #        ${passParams} \
    #        "${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${keystore}/keys" 
    quiet_curl=1
    echo curl -X POST -H "Content-Type: multipart/form-data" \
           -F file="@${tmpksdir}/${keystore}.jar" \
           "${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${keystore}/keys"
    
    MYCURL -X POST -H "Content-Type: multipart/form-data" \
           -F file="@${tmpksdir}/${keystore}.jar" \
           "${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${keystore}/keys?${qparams}"
    quiet_curl=0

    if [[ ${CURL_RC} -ne 204 ]]; then
        echo CURL_RC = ${CURL_RC}
        echo an error occurred while populating the keystore.
        echo
        [[ -f ${CURL_OUT} ]] && cat ${CURL_OUT}
        echo
        echo
        CleanUp
        exit
    fi
    
    if [[ $verbosity -gt 2 ]]; then
        echo
        echo "NOTE: keyalias is ${keyalias}"
        echo
    fi
    
    if [[ $verbosity -gt 1 ]]; then
      cat ${CURL_OUT}
      echo
    fi
}


function verifyKeyStore() {
    [[ $verbosity -gt 0 ]] && echo "verifying the keystore..."
    MYCURL -X GET "${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${keystore}"

    if [[ ${CURL_RC} -ne 200 ]]; then
        echo CURL_RC = ${CURL_RC}
        echo an error occurred while verifying the keystore.
        echo
        cat ${CURL_OUT}
        echo
        echo
        CleanUp
        exit
    fi
    
    if [[ $verbosity -gt 1 ]]; then
      cat ${CURL_OUT}
      echo
    fi
    
    MYCURL -X GET "${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${keystore}/keys"

    if [[ ${CURL_RC} -ne 200 ]]; then
        echo CURL_RC = ${CURL_RC}
        echo an error occurred while verifying the keystore.
        echo
        cat ${CURL_OUT}
        echo
        echo
        CleanUp
        exit
    fi
    
    if [[ $verbosity -gt 1 ]]; then
      cat ${CURL_OUT}
      echo
    fi
}

function populateKeyStoreRef() {
    local payload
    [[ $verbosity -gt 0 ]] && echo "creating the keystore reference..."
    
    # the whitespace in this payload is just for prettifying the output in verbose mode
    payload=$'\n  {\n'
    payload+=$'    "name" : "'${keystoreref}$'",\n'
    payload+=$'    "refers" : "'${keystore}$'",\n'
    payload+=$'    "resourceType" : "KeyStore"\n'
    payload+=$'  }\n'

    MYCURL -X POST -H content-type:application/json \
           ${mgmtserver}/v1/o/${orgname}/e/${envname}/references \
           -d "${payload}"
    
    if [[ ${CURL_RC} -ne 201 ]]; then
        echo CURL_RC = ${CURL_RC}
        echo an error occurred while creating the keystore reference
        echo
        [[ -f ${CURL_OUT} ]] && cat ${CURL_OUT}
        echo
        echo
        CleanUp
        exit
    fi
    
    if [[ $verbosity -gt 1 ]]; then
      cat ${CURL_OUT}
      echo
    fi
}



## =======================================================

echo
echo "This script creates a keystore JAR and creates a new keystore in Edge. "
echo "=============================================================================="

while getopts "hm:o:e:u:nc:k:t:K:R:qv" opt; do
  case $opt in
    h) usage ;;
    m) mgmtserver=$OPTARG ;;
    o) orgname=$OPTARG ;;
    e) envname=$OPTARG ;;
    u) credentials="-u $OPTARG" ;;
    n) netrccreds=1 ;;
    c) certfile=$OPTARG ;;
    k) keyfile=$OPTARG ;;
    t) nametag=$OPTARG ;;
    K) keystore=$OPTARG ;;
    R) keystoreref=$OPTARG ;;
    q) verbosity=$(($verbosity-1)) ;;
    v) verbosity=$(($verbosity+1)) ;;
    *) echo "unknown arg" && usage ;;
  esac
done

echo
if [[ "X$mgmtserver" = "X" ]]; then
  mgmtserver="$defaultmgmtserver"
fi 

if [[ "X$orgname" = "X" ]]; then
    echo "You must specify an org name (-o)."
    echo
    usage
    exit 1
fi

if [[ "X$envname" = "X" ]]; then
    echo "You must specify an environment name (-e)."
    echo
    usage
    exit 1
fi

if [[ "X$keystoreref" = "X" ]]; then
    echo "You must specify a name for the keystore ref (-R)."
    echo
    usage
    exit 1
fi 

if [[ "X$credentials" = "X" ]]; then
  if [[ ${netrccreds} -eq 1 ]]; then
    credentials='-n'
  else
    choose_credentials
  fi 
else
  maybe_ask_password
fi 

check_org 
if [[ ${check_org} -ne 0 ]]; then
  echo "that org cannot be validated"
  CleanUp
  exit 1
fi

check_env
if [[ ${check_env} -ne 0 ]]; then
  echo "that environment cannot be validated"
  CleanUp
  exit 1
fi


if [[ "X$keystore" = "X" ]]; then
    keystore="${nametag:-keystore}-"$(gen_timestamp)
    [[ $verbosity -gt 0 ]] && echo "using keystore name: ${keystore}"
fi

validateCertFile
validatePrivateKeyFile
validateKeyStore
createKeystoreJar
createKeyStore
populateKeyStore
verifyKeyStore
populateKeyStoreRef


echo 
echo done.
echo
CleanUp

