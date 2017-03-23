#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# createAndLoadTrustStore.sh
#
# For reference see http://docs.apigee.com/api-services/content/keystores-and-truststores
# 
# Created: <Tue Jan 17 18:21:42 2017>
# Last Updated: <2017-March-23 13:48:56>
#

defaultmgmtserver="https://api.enterprise.apigee.com"
truststoreName=""
credentials=""
netrccreds=0
orgname=""
envname=""
verbosity=1
pemfiles=()

usage() {
  local CMD=$(basename $0)
  echo "$CMD: "
  echo "  Creates a truststore in Apigee Edge, and loads a cert, or multiple certs, into it."
  echo "  Uses the curl and openssl programs, which must be on the path."
  echo "usage: "
  echo "  $CMD [options] "
  echo "options: "
  echo "  -m url    optional. the base url for the mgmt server."
  echo "  -o org    required. the org to use."
  echo "  -e env    required. the environment to use. default: ${envname}"
  echo "  -u creds  optional. http basic authn credentials for the API calls."
  echo "  -n        optional. tells curl to use .netrc to retrieve credentials"
  echo "  -t name   required; the name of the truststore to use"
  echo "  -p file   required; a PEM file to be added to the truststore"
  echo "  -q        quiet; decrease verbosity by 1"
  echo "  -v        verbose; increase verbosity by 1"
  echo
  echo "Current parameter values:"
  echo "  mgmt api url: $defaultmgmtserver"
  echo "     verbosity: $verbosity"
  echo
  exit 1
}

MYCURL() {
  [[ -z "${CURL_OUT}" ]] && CURL_OUT=`mktemp /tmp/apigee-edge-provision-truststore.curl.out.XXXXXX`
  [[ -f "${CURL_OUT}" ]] && rm ${CURL_OUT}
  [[ $verbosity -gt 0 ]] && echo "curl $@"

  # run the curl command
  CURL_RC=`curl $credentials -s -w "%{http_code}" -o "${CURL_OUT}" "$@"`
  [[ $verbosity -gt 0 ]] && echo "==> ${CURL_RC}"
  [[ $verbosity -gt 0  && -f "${CURL_OUT}" ]] && echo && cat ${CURL_OUT} && echo
}

CleanUp() {
  [[ -f ${CURL_OUT} ]] && rm -rf ${CURL_OUT}
}

choose_credentials() {
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

maybe_ask_password() {
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


check_org() {
  [[ $verbosity -gt 0 ]] && echo "checking org ${orgname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}
  if [[ ${CURL_RC} -eq 200 ]]; then
    check_org=0
  else
    check_org=1
  fi
}


## =======================================================

while getopts "hm:o:e:u:np:t:qv" opt; do
  case $opt in
    h) usage ;;
    m) mgmtserver=$OPTARG ;;
    o) orgname=$OPTARG ;;
    e) envname=$OPTARG ;;
    t) truststoreName=$OPTARG ;;
    u) credentials="-u $OPTARG" ;;
    n) netrccreds=1 ;;
    p) pemfiles+=("$OPTARG") ;;
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
    echo "You must specify an env name (-e)."
    echo
    usage
    exit 1
fi
if [[ "X$truststoreName" = "X" ]]; then
    echo "You must specify a truststore name (-t)."
    echo
    usage
    exit 1
fi

if [[ ${#pemfiles[@]} -eq 0 ]]; then
    echo "You must specify at least one PEM file (-p)."
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


MYCURL -X POST -H "Content-Type:application/json" \
     ${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores \
     -d '{ "name": "'${truststoreName}'" }'


for cert in ${pemfiles[@]} ; do
   MYCURL -X POST -H "Content-Type: multipart/form-data" \
          -F file="@${cert}" \
          ${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${truststoreName}/certs?alias=${cert} 
done

# verify
MYCURL -X GET -H "Accept:application/json" \
     ${mgmtserver}/v1/o/${orgname}/e/${envname}/keystores/${truststoreName}

CleanUp

