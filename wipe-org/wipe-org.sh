#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# wipe-org.sh 
#
# A bash script for wiping out an Apigee Edge organization. It:
#  - deletes all developer apps 
#  - deletes all API Products 
#  - deletes all developers
#  - undeploys all API proxies from any environment in a given organization
#  - deletes  all API proxies
#  - remove KVMs, vaults, custom reports, although this is not well tested
#
# optionally, it can also: 
#  - dis-associates servers from environments
#  - deletes environments
#  - dis-associates pods from orgs
#  - deletes the org
#
# The latter group may be helpful if you are using OPDK.
#
# BUGS: 
# - does not remove vhosts from environments. Should it? 
# - does not remove ldap resources. Should it? 
# - not fully tested
# - relies on python for parsing json.  ick.
# 
# Copyright © 2014,2016 Dino Chiesa and Apigee Corp
# All rights reserved.
#
# created: 2014-Jun-03
# Last saved: <2016-April-25 11:28:15>
#

verbosity=1
want_pause=0
resetonly=0
deprovision_org=0
defaultmgmtserver="https://api.enterprise.apigee.com"
mgmtserver=""
netrccreds=0
credentials=""
TAB=$'\t'

function usage() {
  local CMD=`basename $0`
  echo "$CMD: wipes out an Apigee Edge Organization. "
  echo "  Uses the curl utility."
  echo "usage: "
  echo "  $CMD [options] "
  echo "options: "
  echo "  -m url     the base url for the mgmt server."
  echo "  -o org     the organization to undeploy from."
  echo "  -u creds   username, or http basic authn credentials for the API calls. if password is"
  echo "             omitted, then the script prompts."
  echo "  -n         in lieu of -u. use .netrc to retrieve credentials"
  echo "  -P         also deprovisions org, env, pods, etc. For OPDK only. "
  echo "  -q         quiet; decrease verbosity by 1"
  echo "  -v         verbose; increase verbosity by 1"
  echo
  echo "Current parameter values:"
  echo "  mgmt api url: $defaultmgmtserver"
  echo "     verbosity: $verbosity"
  echo
  exit 1
}


## function MYCURL
## Print the curl command then run it.
##
## Implicit input: 
##  $credentials = must contain one of the following:
##        -u username:password
##        -n 
##
## output by side effect:
## 1. puts curl output into file named ${CURL_OUT}. If the CURL_OUT
##    env var is not set prior to calling this function, it is created
##    and the name of a tmp file in /tmp is placed there.
## 2. puts curl http_status into variable CURL_RC
##
function MYCURL() {
  local allargs
  local ix=0
  # grab the curl args
  while [ "$1" ]; do
    allargs[$ix]=$1
    let "ix+=1"
    shift
  done
  [ -z "${CURL_OUT}" ] && CURL_OUT=`mktemp /tmp/apigee-wipe-org.curl.out.XXXXXX`
  [ -f "${CURL_OUT}" ] && rm ${CURL_OUT}
  [ $verbosity -gt 1 ] && echo && echo "curl ${allargs[@]}"
  # run the curl command
  CURL_RC=`curl $credentials -s -w "%{http_code}" -o "${CURL_OUT}" "${allargs[@]}"`
  [ $verbosity -gt 1 ] && echo "==> ${CURL_RC}"
}


function get_json_value () { 
 cat ${CURL_OUT} | python -c 'import json,sys;obj=json.load(sys.stdin);print '$1';' 
}

function check_curl_status() {
  local value
  local msg
  value=$1
  msg=$2
  #echo "check ${CURL_RC} -ne ${value} "
  if [ ${CURL_RC} -ne ${value} ]; then
      echo 
      echoerror ${msg}
      cat ${CURL_OUT}
      echo 
      echo 
      [ -f ${CURL_OUT} ] && rm -rf ${CURL_OUT}
      exit 1
  fi
}

function echoerror() { echo "$@" 1>&2; }

function CleanUp() {
  if [ -f ${CURL_OUT} ]; then
    rm -rf ${CURL_OUT}
  fi
}

function maybe_pause() {
  local foo
  [ ${want_pause} -gt 0 ] && read -p "ENTER to continue... " foo
}

function choose_mgmtserver() {
  local name
  echo
  read -p "  Which mgmt server (${defaultmgmtserver}) :: " name
  name="${name:-$defaultmgmtserver}"
  mgmtserver=$name
  echo "  mgmt server = ${mgmtserver}"
}

function choose_credentials() {
  local username
  read -p "orgadmin username for org ${org} at ${mgmtserver} ? (blank to use .netrc): " username
  echo
  if [[ "X$username" = "X" ]] ; then  
    credentials="-n"
  else
    choose_password $username
  fi
}

function choose_password() {
    local username=$1 password
    echo -n "Password for $username: "
    read -s password
    echo
    credentials="-u ${username}:${password}"
}

function check_org() {
  echo "  checking org ${orgname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}/e
  if [ ${CURL_RC} -eq 200 ]; then
    check_org=0
    envarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  else
    check_org=1
  fi
}


function choose_org() {
  local all_done
  all_done=0
  while [ $all_done -ne 1 ]; do
      echo
      read -p "  Which organization? " orgname
      check_org 
      if [ ${check_org} -ne 0 ]; then
        echo cannot read that organization with the given creds.
        echo
        all_done=0
      else
        all_done=1
      fi
  done
  echo
  echo "  organization = ${orgname}"
}


function random_string() {
  local rand_string
  rand_string=$(cat /dev/urandom |  LC_CTYPE=C  tr -cd '[:alnum:]' | head -c 10)
  echo ${rand_string}
}

function remove_all_developers_and_apps() {
  local devarray dev numdeleteddevs apparray app i j org=$1
  echo "  check for developers ..."
  MYCURL -X GET ${mgmtserver}/v1/o/${org}/developers
  check_curl_status 200  "  could not retrieve developers from that org..."

  devarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  if [ "${#devarray[@]}" -gt 0 ]; then 
    for i in "${!devarray[@]}"
    do
      dev=${devarray[i]}
      echo "  list the apps for developer ${dev}..."
      MYCURL -X GET "${mgmtserver}/v1/o/${org}/developers/${dev}/apps"
      check_curl_status 200  "  could not retrieve apps for that developer..."
      apparray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
      if [ "${#apparray[@]}" -gt 0 ]; then
        for j in "${!apparray[@]}"
          do
            app=${apparray[j]}
            echo "  delete the app ${app}..."
            MYCURL -X DELETE "${mgmtserver}/v1/o/${org}/developers/${dev}/apps/${app}"
            check_curl_status 200  "  could not delete that app (${app})..."
          done
        else
          echo "  no apps to delete..."
        fi

        echo "  delete the developer $dev..."
        MYCURL -X DELETE "${mgmtserver}/v1/o/${org}/developers/${dev}"
        check_curl_status 200  "  could not delete that developer (${dev})"
        let "numdeleteddevs+=1"
    done
    echo "  deleted ${numdeleteddevs} developers...."
  else 
    echo "  found no developers in that org..."
  fi
}


function remove_all_apiproducts() {
  local prodarray prod i org=$1
  echo "  check for api products ..."
  MYCURL -X GET ${mgmtserver}/v1/o/${org}/apiproducts
  check_curl_status 200  "  could not retrieve apiproducts from that org..."
  prodarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  for i in "${!prodarray[@]}"; do
    prod=${prodarray[i]}
    echo "  delete product ${prod}..."
    MYCURL -X DELETE ${mgmtserver}/v1/o/${org}/apiproducts/${prod}
    check_curl_status 200  "  could not delete that product (${prod})"
  done
}


function undeploy_and_delete_all_apis() {
  local org=$1 revisionarray rev api allapis envarray envname i j k

  echo "  get all APIs defined in Organization ${org}..."
  sleep 2
  MYCURL  -X GET ${mgmtserver}/v1/o/${org}/apis 
  check_curl_status 200  "  could not retrieve the list of apis"

  allapis=(`cat ${CURL_OUT} | sed -E 's/[]",[]//g'`)
  #echo "  allapis: ${allapis}"
  for i in "${!allapis[@]}"
  do
    api=${allapis[i]}
    echo "  check for the ${api} api..."
    MYCURL -X GET ${mgmtserver}/v1/o/${org}/apis/${api}
    check_curl_status 200  "  could not retrieve that api (${api})"

    revisionarray=(`cat ${CURL_OUT} | grep "revision" | sed -E 's/[]",:[]//g'`)
    revisionarray=( "${revisionarray[@]:1}" ) 
    for j in "${!revisionarray[@]}"
    do
      rev=${revisionarray[j]}

      MYCURL -X GET \
           "${mgmtserver}/v1/o/${org}/apis/${api}/revisions/${rev}/deployments"
      check_curl_status 200  "  could not get deployments (${api},${rev})"

      numenvironments=`get_json_value 'len(obj["environment"])'`
      envarray=() 
      k=0
      # first build the array of environment names to which this API is deployed
      while [ $k -lt $numenvironments ]; do
        # undeploy from that environment
        envname=`get_json_value 'obj["environment"]['$k']["name"]'`
        envarray+=($envname)
        let "k+=1"
      done

      for k in "${!envarray[@]}"
      do
        envname=${envarray[k]}
        echo "  undeploy the api ${api} revision ${rev} from ${envname}"
        MYCURL -X POST "${mgmtserver}/v1/o/${org}/apis/${api}/revisions/${rev}/deployments?action=undeploy&env=${envname}"
        check_curl_status 200  "  could not undepoy that API revision (${api},${rev})"
      done
      echo "  delete the api revision ${rev}"
      MYCURL -X DELETE "${mgmtserver}/v1/o/${org}/apis/${api}/revisions/${rev}"
      check_curl_status 200  "  could not delete that API revision (${api},${rev})"
    done

    echo "  delete the api"
    MYCURL -X DELETE ${mgmtserver}/v1/o/${org}/apis/${api}
    check_curl_status 200  "  could not delete that API (${api})"
  done
}


function remove_all_vaults() {
  local org=$1 envarray env vaultarray vault i j
  echo "  removing all vaults in organization $org..."
  envarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  for i in "${!envarray[@]}"; do
    env=${envarray[i]}
    echo "  list vaults for that env..." 
    MYCURL -X GET  ${mgmtserver}/v1/o/${org}/e/${env}/vaults
    vaultarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)

    for j in "${!vaultarray[@]}" ; do
        vault=${vaultarray[j]}
        MYCURL -X DELETE -H content-type:application/json $mgmtserver/v1/o/$org/e/$env/vaults/$vault
    done

  done
  
  MYCURL -X GET  ${mgmtserver}/v1/o/${org}/vaults
  vaultarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  for j in "${!vaultarray[@]}" ; do
      vault=${vaultarray[j]}
      MYCURL -X DELETE -H content-type:application/json $mgmtserver/v1/o/$org/vaults/$vault
  done
}

function remove_all_kvms() {
  local org=$1 envarray env kvmarray kvm i j
  echo "  removing all kvms in organization $org..."
  envarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  for i in "${!envarray[@]}"; do
    env=${envarray[i]}
    echo "  list kvms for that env..." 
    MYCURL -X GET  ${mgmtserver}/v1/o/${org}/e/${env}/kvms
    kvmarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)

    for j in "${!kvmarray[@]}" ; do
        kvm=${kvmarray[j]}
        MYCURL -X DELETE -H content-type:application/json $mgmtserver/v1/o/$org/e/$env/kvms/$kvm
        check_curl_status 200  "  could not delete kvm $kvm"
    done

  done
  
  MYCURL -X GET  ${mgmtserver}/v1/o/${org}/kvms
  kvmarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  for j in "${!kvmarray[@]}" ; do
      kvm=${kvmarray[j]}
      MYCURL -X DELETE -H content-type:application/json $mgmtserver/v1/o/$org/kvms/$kvm
      check_curl_status 200  "  could not delete kvm $kvm"
  done
}


function remove_all_reports() {
  local org=$1 reportarray report j
  echo "  removing all reports in organization $org..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${org}/reports
  reportarray=(`cat ${CURL_OUT} | grep \"name\" | sed -E 's/[]",:[]//g' | sed -E 's/name//g'`)
  for j in "${!reportarray[@]}" ; do
      report=${reportarray[j]}
      echo $report
      MYCURL -X DELETE -H content-type:application/json $mgmtserver/v1/o/$org/reports/$report
      check_curl_status 200  "  could not delete report $report"
  done
}


function remove_all_environments() {
  local org=$1 envarray env server serverarray servertype i j

  MYCURL -X GET  ${mgmtserver}/v1/o/${org}/e
  check_curl_status 200  "  could not list environments"

  envarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)
  for i in "${!envarray[@]}"
  do
    env=${envarray[i]}
    echo "  list servers for that env..." 
    MYCURL -X GET  ${mgmtserver}/v1/o/${org}/e/${env}/servers
    serverarray=(`cat ${CURL_OUT} | grep "\[" | sed -E 's/[]",[]//g'`)

    for j in "${!serverarray[@]}"
    do
      server=${serverarray[j]}
      ##MYCURL -X GET  ${mgmtserver}/v1/servers/${server}
      ##check_curl_status 200  "could not inquire server (${server})"
      ##servertype=`get_json_value 'obj["type"][0]'`
      ##if [ "X$servertype" = "Xmessage-processor" ]; then
        MYCURL -X POST \
           -H Content-Type:application/x-www-form-urlencoded \
           "${mgmtserver}/v1/o/${org}/e/${env}/servers" \
           -d "action=remove&uuid=${server}" 
        check_curl_status 200  "could not disassociate server (${server})"
      ## fi
    done

    echo "  delete the environment ${env}..."
    MYCURL -X DELETE "${mgmtserver}/v1/o/${org}/e/${env}"
    check_curl_status 200 "  could not delete that environment (${env})"
  done
}


function disassociate_pods() {
  local podarray
  local regionarray
  local pod
  local region
  local numpods
  local i
  org=$1

  MYCURL -X GET  ${mgmtserver}/v1/o/${org}/pods
  check_curl_status 200  "  could not list pods"

  numpods=`get_json_value 'len(obj)'`
  podarray=()
  regionarray=()
  k=0
  # first build the array of pod names associated to the org
  while [ $k -lt $numpods ]; do
     pod=`get_json_value 'obj['$k']["name"]'`
     podarray+=($pod)
     region=`get_json_value 'obj['$k']["region"]'`
     regionarray+=($region)
     let "k+=1"
  done

  for i in "${!podarray[@]}"
  do
    pod=${podarray[i]}
    region=${regionarray[i]}
    echo "  dis-associate pod ${pod}..."
    MYCURL -X POST ${mgmtserver}/v1/o/${org}/pods \
     -H Content-Type:application/x-www-form-urlencoded \
     -d "action=remove&region=${region}&pod=${pod}"

    check_curl_status 200  "  could not dis-associate pod (${pod})"
  done
}



function delete_org() {
  local org=$1
  echo "  delete the organization $org..."
  MYCURL -X DELETE "${mgmtserver}/v1/o/${org}"
  check_curl_status 200  "  could not delete that org (${org})"
}



## function wipe_org
##
## Removes any developer app, and any developer, and API product in an
## org. Also undeploys any API, and rmeoves same, and removes reports,
## kvms, and vaults.
##
## optionally "de-provisions" the org, removing environments and
## disassociating pods and deleting the org. Useful for OPDK only.
##
function wipe_org() {
  local org=$1
  remove_all_developers_and_apps ${org}
  remove_all_apiproducts ${org}
  undeploy_and_delete_all_apis ${org}
  remove_all_reports ${org}
  remove_all_vaults ${org}
  remove_all_kvms ${org}
  if [ $deprovision_org -gt 0 ]; then
    remove_all_environments ${org}
    disassociate_pods ${org}
    ## finally, delete the org
    delete_org ${org}
  fi
}




## =======================================================

echo
echo "This script undeploys all APIs from the specified org, or from the specified "
echo "environment within an org. "
echo "============================================================================="

while getopts "vqho:u:nm:Pp" opt; do
  case $opt in
    h) usage ;;
    q) verbosity=$(($verbosity-1)) ;;
    v) verbosity=$(($verbosity+1)) ;;
    o) orgname=$OPTARG ;;
    m) mgmtserver=$OPTARG ;;
    u) credentials=$OPTARG ;;
    n) netrccreds=1 ;;
    P) deprovision_org=1 ;;
    p) want_pause=1 ;;
    *) echo "unknown arg" && usage ;;
  esac
done

echo
if [ "X$mgmtserver" = "X" ]; then
    mgmtserver=$defaultmgmtserver
fi 


if [ ${netrccreds} -eq 1 ]; then
  echo "using credentials from .netrc"
  credentials='-n'
elif [ "X$credentials" = "X" ]; then
    choose_credentials
elif [[ $credentials == *":"* ]]; then
    ## credentials contains a colon; its a username:password
  credentials="-u $credentials"
else
    # no colon; prompt for password
    choose_password $credentials
fi

  
echo
if [ "X$orgname" = "X" ]; then
  choose_org
else
  check_org 
  if [ ${check_org} -ne 0 ]; then
    echoerror "that organization cannot be validated"
    exit 1
  fi
fi 


echo
echo
echo
read -p "Now going to WIPE OUT the org ${orgname}, OK? (y/N) :: " isok
isok="${isok:-N}"

if [ "X$isok" = "Xy" ]; then
  read -p "This action is irreversible. You will lose data. Really OK? (y/N) :: " isok
  isok="${isok:-N}"
  if [ "X$isok" = "Xy" ]; then
    wipe_org ${orgname}
  fi
fi

CleanUp
exit 0

