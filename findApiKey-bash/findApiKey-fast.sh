#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# findApiKey-fast.sh
#
# A bash script for finding a particular API Key in an Apigee Edge organization.
#
# It is a challenge in bash to reliably parse the JSON for an app with
# multiple credentials.  Because of the naive approach used here, this
# tool will work if there is a single credential per app, but will fail
# if there are multiple credentials per app. To avoid that problem, use
# a tool built in a real language, eg,
# https://github.com/DinoChiesa/EdgeTools/tree/master/findApiKey
#
# or use a more deliberate approach, see findApiKey-slowAndCorrect.sh
#
# Last saved: <2016-April-23 08:55:00>
#

verbosity=1
defaultmgmtserver="https://api.enterprise.apigee.com"
credentials=""
keytofind=""
netrccreds=0
TAB=$'\t'

function usage() {
  local CMD=`basename $0`
  echo "$CMD: "
  echo "  Finds an API key in a particular organization, by using expand=true."
  echo "  Uses the curl utility. "
  echo "  NB: This tool will fail if there are multiple credentials per app."
  echo "  In that case, use a language like JavaScript that can really parse JSON. "
  echo "usage: "
  echo "  $CMD [options] "
  echo "options: "
  echo "  -m url    the base url for the mgmt server."
  echo "  -o org    the org to use."
  echo "  -u creds  http basic authn credentials for the API calls."
  echo "  -n        tells curl to use .netrc to retrieve credentials"
  echo "  -k key    the api key to find"
  echo "  -q        quiet; decrease verbosity by 1"
  echo "  -v        verbose; increase verbosity by 1"
  echo
  echo "Current parameter values:"
  echo "  mgmt api url: $defaultmgmtserver"
  echo "     verbosity: $verbosity"
  echo
  exit 1
}

function MYCURL() {
  local allargs
  local ix=0
  # grab the curl args
  while [ "$1" ]; do
    allargs[$ix]=$1
    let "ix+=1"
    shift
  done
  [ -z "${CURL_OUT}" ] && CURL_OUT=`mktemp /tmp/apigee-findApiKey.curl.out.XXXXXX`
  [ -f "${CURL_OUT}" ] && rm ${CURL_OUT}
  if [ $verbosity -eq 1 ]; then
    echo -n "."
  elif [ $verbosity -gt 1 ]; then
    echo "curl ${allargs[@]}"
  fi
  # run the curl command
  CURL_RC=`curl $credentials -s -w "%{http_code}" -o "${CURL_OUT}" "${allargs[@]}"`
  if [ $verbosity -gt 1 ]; then
    echo "==> ${CURL_RC}"
  fi
}


function clean_up() {
  if [ -f ${CURL_OUT} ]; then
    rm -rf ${CURL_OUT}
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


function choose_credentials() {
  local username password

  read -p "username for Edge org ${orgname} at ${mgmtserver} ? (blank to use .netrc): " username
  echo
  if [[ "$username" = "" ]] ; then  
    credentials="-n"
  else
    echo -n "Password for ${username} at ${orgname}: "
    read -s password
    echo
    credentials="-u ${username}:${password}"
  fi
}

function check_org() {
  echo "checking org ${orgname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}
  if [ ${CURL_RC} -eq 200 ]; then
    check_org=0
  else
    check_org=1
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
  echo
  echo "  org = ${orgname}"
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
  echo
  echo "  env = ${envname}"
}


function scan_all_apps() {
  local apparray appinfo app appId appName devId
  local lookingfor=$1 found=0
  if [ $verbosity -gt 1 ]; then
    echo
    echo "scanning registered apps..."
  fi
  MYCURL -X GET "${mgmtserver}/v1/o/${orgname}/apps?expand=true"
  if [ ${CURL_RC} -ne 200 ]; then
    echo 
    echo "Cannot retrieve apps from that org..."
    echo
    exit 1
  fi
  apparray=(`cat ${CURL_OUT} | grep "appId" | sed -E 's/[]",:[]//g' | sed -E 's/appId//g'`)
  if [ $verbosity -eq 1 ]; then
    echo
  fi 
  echo "found ${#apparray[@]} apps"
  if [ $verbosity -gt 1 ]; then
    for i in "${!apparray[@]}"; do
        appId=${apparray[i]}
        echo app id: $appId
    done
  fi

  ## first do the basic search
  cat ${CURL_OUT} | grep $lookingfor 2>&1 > /dev/null
  if [ $? -eq 0 ]; then
      found=1
      echo "found key $lookingfor"
      appinfo=`cat ${CURL_OUT} | grep -B 26 -A 13 $lookingfor`  
      if [ $verbosity -gt 1 ]; then
          echo "$appinfo"
      fi
      appId=`cat ${CURL_OUT} | grep -B 23 $lookingfor | grep "appId" | sed -E 's/[]",:[]//g' | sed -E 's/appId//g' | tr -d '[[:space:]]'`
      appName=`cat ${CURL_OUT} | grep -A 13 $lookingfor | grep "name" | sed -E 's/[]",:[]//g' | sed -E 's/name//g' | tr -d '[[:space:]]'`
      devId=`cat ${CURL_OUT} | grep -A 11 $lookingfor | grep "developerId" | sed -E 's/[]",:[]//g' | sed -E 's/developerId//g' | tr -d '[[:space:]]'`
      echo "app name    : $appName"
      echo "appId       : $appId"
      echo "developerId : $devId"
  fi
  if [ ${found} -eq 0 ]; then 
    echo "could not find that key."
  fi
}


## =======================================================

echo
echo "This script finds the appId and developerId for an API key. " 
echo "=============================================================================="

while getopts "hm:o:u:nk:drqv" opt; do
  case $opt in
    h) usage ;;
    m) mgmtserver=$OPTARG ;;
    o) orgname=$OPTARG ;;
    u) credentials=$OPTARG ;;
    n) netrccreds=1 ;;
    k) keytofind=$OPTARG ;;
    q) verbosity=$(($verbosity-1)) ;;
    v) verbosity=$(($verbosity+1)) ;;
    *) echo "unknown arg" && usage ;;
  esac
done

echo
if [ "X$mgmtserver" = "X" ]; then
  mgmtserver="$defaultmgmtserver"
fi 

if [ "X$keytofind" = "X" ]; then
  echo "you must specify an apikey to find." 
  echo
  usage
  exit 1
fi 

if [ "X$credentials" = "X" ]; then
  if [ ${netrccreds} -eq 1 ]; then
    credentials='-n'
  else
    choose_credentials
  fi 
else
  maybe_ask_password
fi 

if [ "X$orgname" = "X" ]; then
  choose_org
else
  check_org 
  if [ ${check_org} -ne 0 ]; then
    echo "that org cannot be validated"
    clean_up
    exit 1
  fi
fi 

scan_all_apps $keytofind

clean_up

exit 0

