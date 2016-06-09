#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# diffApiproxyRevisions.sh
#
# Licensed under the Apache 2.0 source license. See the LICENSE file accompanying this script. 
#
# Created: <Thu Jun  9 15:25:53 2016>
# Last Updated: <2016-June-09 16:02:51>
#

verbosity=1
netrccreds=0
apiproxy=""
revisions=()
defaultmgmtserver="https://api.enterprise.apigee.com"
credentials=""
numre='^[0-9]+$'
TAB=$'\t'

function usage() {
  local CMD=`basename $0`
  echo "$CMD: "
  echo "  Produces a diff of two revisions of an API proxy in Apigee Edge."
  echo "  Uses the curl and diff utilities."
  echo "usage: "
  echo "  $CMD [options] "
  echo "options: "
  echo "  -o org    the org to use."
  echo "  -u user   Edge admin user for the Admin API calls."
  echo "  -n        use .netrc to retrieve credentials (in lieu of -u)"
  echo "  -m url    the base url for the mgmt server."
  echo "  -a proxy  the apiproxy to use. should already be present in the org."
  echo "  -R n      the revision number. Specify this twice."
  echo "  -q        quiet; decrease verbosity by 1"
  echo "  -v        verbose; increase verbosity by 1"
  echo
  echo "Current parameter values:"
  echo "  mgmt api url: $defaultmgmtserver"
  echo "     verbosity: $verbosity"
  echo
  exit 1
}

## function MYCURL
## Print the curl command, omitting sensitive parameters, then run it.
## There are side effects:
## 1. puts curl output into file named ${CURL_OUT}. If the CURL_OUT
##    env var is not set prior to calling this function, it is created
##    and the name of a tmp file in /tmp is placed there.
## 2. puts curl http_status into variable CURL_RC
function MYCURL() {
  [ -z "${CURL_OUT}" ] && CURL_OUT=`mktemp /tmp/apigee-multirev-demo.curl.out.XXXXXX`
  [ -f "${CURL_OUT}" ] && rm ${CURL_OUT}
  [ $verbosity -gt 0 ] && echo "curl $@"
  # run the curl command
  CURL_RC=`curl $credentials -s -w "%{http_code}" -o "${CURL_OUT}" "$@"`
  [ $verbosity -gt 0 ] && echo "==> ${CURL_RC}"
}


function CleanUp() {
  [ -f ${CURL_OUT} ] && rm -rf ${CURL_OUT}
  [ -d ${TMP_DIFF_DIR} ] && rm -rf ${TMP_DIFF_DIR}
}

function choose_mgmtserver() {
  local name
  echo
  read -p "  Which mgmt server (${defaultmgmtserver}) :: " name
  name="${name:-$defaultmgmtserver}"
  mgmtserver=$name
  echo "  mgmt server = ${mgmtserver}"
}


function verify_numeric() {
    local num=$1 label=$2
    if ! [[ $num =~ $numre ]] ; then
        echo "error: $label is not a number" >&2
        echo
        usage
        exit 1
    fi
    if [[ $num -le 0 ]]; then
        echo "error: $label must be positive" >&2
        echo
        usage
        exit 1
    fi
}

function verify_revisions() {
    local num_revs=${#revisions[@]}
    local i rev
    if [ $num_revs -ne 2 ] ; then
        echo "error: specify exactly two revisions" >&2
        echo
        usage
        exit 1
    fi 
    for i in "${!revisions[@]}"; do
        rev=${revisions[$i]}
        verify_numeric "$rev" "revision"
    done
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
  echo "  checking org ${orgname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}
  if [ ${CURL_RC} -eq 200 ]; then
    check_org=0
  else
    check_org=1
  fi
}

function export_proxy_revisions() {
    local rev original_dir diff_cmd_string=""
    [ -z "${TMP_DIFF_DIR}" ] && TMP_DIFF_DIR=`mktemp -d /tmp/apigee-proxy-diff.XXXXXX`
    original_dir=${PWD}
    cd ${TMP_DIFF_DIR}
    for rev in ${revisions[@]} ; do
        echo $rev
        curl $credentials -o ${apiproxy}-r${rev}.zip \
             "${mgmtserver}/v1/o/${orgname}/apis/${apiproxy}/revisions/${rev}?format=bundle"
        [ -f ${apiproxy}-r${rev}.zip ] && unzip -d ${apiproxy}-r${rev} ${apiproxy}-r${rev}.zip
        [ ! -d ${apiproxy}-r${rev} ] && echo "cannot unzip ${apiproxy}-r${rev}.zip" && exit 1
        diff_cmd_string+="${apiproxy}-r${rev} "
    done
    eval "diff -r $diff_cmd_string"
    cd ${original_dir}
}


## =======================================================

echo
echo "This script downloads two API proxy revisions and performs a diff on them."
echo "=============================================================================="

while getopts "o:e:u:nm:a:E:R:t:M:Uqvh" opt; do
  case $opt in
    o) orgname=$OPTARG ;;
    u) credentials=$OPTARG ;;
    n) netrccreds=1 ;;
    m) mgmtserver=$OPTARG ;;
    a) apiproxy=$OPTARG ;;
    R) revisions+=( $OPTARG ) ;;
    q) verbosity=$(($verbosity-1)) ;;
    v) verbosity=$(($verbosity+1)) ;;
    h) usage ;;
    *) echo "unknown arg" && usage ;;
  esac
done

echo
if [ "X$mgmtserver" = "X" ]; then
  mgmtserver="$defaultmgmtserver"
fi 

echo
if [ "X$apiproxy" = "X" ]; then
    echo "You must specify an apiproxy (-a)."
    echo
    usage
    exit 1
fi 

if [ "X$orgname" = "X" ]; then
    echo "You must specify an org name (-o)."
    echo
    usage
    exit 1
fi

verify_revisions

if [ "X$credentials" = "X" ]; then
  if [ ${netrccreds} -eq 1 ]; then
    credentials='-n'
  else
    choose_credentials
  fi 
else
  maybe_ask_password
fi 

check_org 
if [ ${check_org} -ne 0 ]; then
  echo "that org cannot be validated"
  CleanUp
  exit 1
fi

export_proxy_revisions


CleanUp

exit 0

