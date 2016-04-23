#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# findApiKey-slowAndCorrect.sh
#
# A bash script for finding a particular API Key in an Apigee Edge organization.

# Each app in Edge can have 

# It is a challenge in bash to reliably parse the JSON for an app with
# multiple credentials.  Because of the deliberate approach used here, this
# tool will work if there is a single credential per app, or
# if there are multiple credentials per app. In all cases the app invokes
# one Admin API call per app, to query the system. This can result in slow performance. 
# To avoid that problem, use
# a tool built in a real language, eg,
# https://github.com/DinoChiesa/EdgeTools/tree/master/findApiKey
#
# or use a more faster but less correct approach, see findApiKey-fast.sh
#
#
# Last saved: <2016-April-23 08:55:24>
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
  echo "  Finds an API key in a particular organization, by brute force search."
  echo "  Uses the curl utility."
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
  [ -z "${CURL_OUT}" ] && CURL_OUT=`mktemp /tmp/apigee-${apiname}.curl.out.XXXXXX`
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
  local keyarray apparray app key keycount=0 array devid appid username firstname lastname appname
  local lookingfor=$1 found=0

  if [ $verbosity -gt 1 ]; then
    echo
    echo "  scanning registered apps..."
  fi
  MYCURL -X GET ${mgmtserver}/v1/o/${orgname}/apps
  if [ ${CURL_RC} -ne 200 ]; then
    echo 
    echo "Cannot retrieve apps from that org..."
    echo
    exit 1
  fi
  apparray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  if [ $verbosity -eq 1 ]; then
    echo
  fi 
  echo "found ${#apparray[@]} apps"
  for i in "${!apparray[@]}"; do
    if [ ${found} -eq 0 ]; then
      app=${apparray[i]}

      MYCURL -X GET "${mgmtserver}/v1/o/${orgname}/apps/${app}"
      keyarray=(`cat ${CURL_OUT} | grep "consumerKey" | sed -E 's/[\",]//g'| sed -E 's/consumerKey ://g'`)
      for j in "${!keyarray[@]}"; do
        if [ ${found} -eq 0 ]; then
          key=${keyarray[j]}
          if [[ "$key" = "${lookingfor}" ]] ; then
            if [ $verbosity -gt 1 ]; then
              echo
              echo "found key"
            fi 
            array=(`cat ${CURL_OUT} | grep "\<developerId\>" | sed -E 's/[\",:]//g'`)
            devid=${array[1]}
            array=(`cat ${CURL_OUT} | grep "\<appId\>" | sed -E 's/[\",:]//g'`)
            appid=${array[1]}
            array=(`cat ${CURL_OUT} | grep -A 1 "\<lastModifiedBy\>" | grep -v "\<lastModifiedBy\>" | sed -E 's/[\",:]//g'`)
            appname=${array[1]}
            MYCURL -X GET "${mgmtserver}/v1/o/${orgname}/developers/${devid}"
            array=(`cat ${CURL_OUT} | grep "\<userName\>" | sed -E 's/[\",:]//g'`)
            username=${array[1]}
            array=(`cat ${CURL_OUT} | grep "\<lastName\>" | sed -E 's/[\",:]//g'`)
            firstname=${array[1]}
            array=(`cat ${CURL_OUT} | grep "\<firstName\>" | sed -E 's/[\",:]//g'`)
            lastname=${array[1]}
            if [ $verbosity -eq 1 ]; then
              echo
            fi
            echo "key: ${keytofind}"
            echo "App: ${appname} ${appid}"
            echo "Dev: ${username} - ${firstname} ${lastname}"
            found=1
          fi
          let "keycount+=1"
        fi
      done
    fi
  done
  if [ ${found} -eq 0 ]; then 
    echo "could not find that key."
  fi
}



## =======================================================

echo
echo "This script finds the developer and app for an API key. " 
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

