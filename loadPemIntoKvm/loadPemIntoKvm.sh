#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# Works with Apigee EDGE only. Not with X / hybrid!
# See the related utility called xloadFileIntoKvm for an example that works with Apigee X/hybrid.
#
# example usage:
#  loadPemIntoKvm.sh -m https://api.e2e.apigee.net -n -o radical-new -e prod  -M secrets -F sampledata/privatekey.pem -N privatekey
#
# Created: <Thu Aug  3 14:05:20 2017>
# Last Updated: <2022-June-24 12:08:55>
#

scriptname=${0##*/}
orgname=""
envname=""
mapname=""
pemfilename=""
kvmentryname=""
mgmtserver=""
defaultmgmtserver="https://api.enterprise.apigee.com"
org_cps_status=0
version="20170817-1358"
verbosity=1
netrccreds=0
credentials=""

usage() {
  local CMD=`basename $0`
  echo "$CMD:"
  echo "  Adds a PEM into an environment-scoped KVM."
  echo "  Uses the curl utility."
  echo "usage:"
  echo "  $CMD [options]"
  echo "  version: ${version}"
  echo "options: "
  echo "  -m url    optional. the base url for the mgmt server. default: $defaultmgmtserver"
  echo "  -o org    required. the org to use."
  echo "  -e env    required. the environment to use. default: ${envname}"
  echo "  -u creds  optional. http basic authn credentials for the API calls."
  echo "  -n        optional. tells curl to use .netrc to retrieve credentials"
  echo "  -M map    required. KVM Map name. The map must exist."
  echo "  -N name   required. name to use withiin KVM."
  echo "  -F file   required. File containing PEM. This becomes the value for the KVM entry."
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
MYCURL() {
    [ -z "${CURL_OUT}" ] && CURL_OUT=`mktemp /tmp/apigee-${scriptname}.curl.out.XXXXXX`
  [[ -f "${CURL_OUT}" ]] && rm ${CURL_OUT}
  [[ $verbosity -gt 0 ]] && echo "curl $@"

  # run the curl command
  CURL_RC=`curl $credentials -s -w "%{http_code}" -o "${CURL_OUT}" "$@"`
  [[ $verbosity -gt 0 ]] && echo "==> ${CURL_RC}"
}

choose_credentials() {
  local username password

  read -p "username for Edge org ${org} at ${mgmtserver} ? (blank to use .netrc): " username
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
  cat ${CURL_OUT} | grep -A 1 features.isCpsEnabled | grep value | grep -q true
  org_cps_status=$?
  if [[ ${org_cps_status} -ne 0 ]]; then
      printf "The org is not CPS enabled.\n"
  else
      printf "The org is CPS enabled.\n"
  fi
  [[ ${CURL_RC} -ne 200 ]]
}

check_env() {
  [[ $verbosity -gt 0 ]] && echo "checking env ${envname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}/e/${envname}
  [[ ${CURL_RC} -ne 200 ]]
}

kvm_entry_exists() {
    local keyname=$1
    MYCURL -X GET ${baseurl}/${mapname}/entries/${kvmentryname}
    if [[ ${CURL_RC} -eq 200 ]]; then
        printf "The KVM entry exists.\n"
    else
        printf "The KVM entry Does Not Exist.\n"
    fi
    [[ ${CURL_RC} -eq 200 ]]
}

CleanUp() {
  [[ -f ${CURL_OUT} ]] && rm -rf ${CURL_OUT}
}

insert_kvm_entry() {
    local payload
    local right_now_millis=$(date +%s000)
    local pem_string=$(cat "$pemfilename")
    if [[ ${org_cps_status} -eq 0 ]]; then
        # CPS enabled
        payload=$'{\n'
        payload+=$'  "name" : "'$kvmentryname$'",\n'
        payload+=$'  "value" : "'
        payload+="${pem_string//$'\n'/\\n}"
        payload+=$'"\n'
        payload+=$'}'

        if kvm_entry_exists $keyname ; then
            # Update
            MYCURL -X POST ${baseurl}/${mapname}/entries/${kvmentryname} -H content-type:application/json \
                   -d "${payload}"
        else
            # Create
            MYCURL -X POST ${baseurl}/${mapname}/entries -H content-type:application/json \
                   -d "${payload}"
        fi
    else
        # not CPS enabled
        payload=$'{\n'
        payload+=$'  "name" : "'$mapname$'",\n'
        payload+=$'  "entry" : [ { '
        payload+=$'  "name" : "'$kvmentryname$'",\n'
        payload+=$'  "value" : "'
        payload+="${pem_string//$'\n'/\\n}"
        payload+=$'"\n'
        payload+=$'  } ]\n'
        payload+=$'}'

        MYCURL -X POST ${baseurl}/${mapname} -H content-type:application/json \
               -d "${payload}"
    fi
    cat ${CURL_OUT}
    printf "\n\n"
}

#========================================================================================

while getopts "hm:o:e:M:u:nF:N:" opt; do
  case $opt in
    h) usage ;;
    m) mgmtserver=$OPTARG ;;
    o) orgname=$OPTARG ;;
    e) envname=$OPTARG ;;
    u) credentials="-u $OPTARG" ;;
    n) netrccreds=1 ;;
    M) mapname=$OPTARG ;;
    F) pemfilename=$OPTARG ;;
    N) kvmentryname=$OPTARG ;;
    *) echo "unknown arg" && usage ;;
  esac
done

echo
if [[ "X$mgmtserver" = "X" ]]; then
  mgmtserver="$defaultmgmtserver"
fi

if [[ "X$orgname" = "X" ]]; then
    printf "You must specify an org name (-o).\n\n"
    usage
    exit 1
fi

if [[ "X$envname" = "X" ]]; then
    printf "You must specify an env name (-e).\n\n"
    usage
    exit 1
fi

if [[ "X$mapname" = "X" ]]; then
    printf "You must specify a map name (-M).\n\n"
    usage
    exit 1
fi

if [[ "X$kvmentryname" = "X" ]]; then
    printf "You must specify a name for the KVM entry (-N).\n\n"
    usage
    exit 1
fi

if [[ "X$pemfilename" = "X" || ! -r "$pemfilename" ]]; then
    printf "You must specify a PEM file (-F) and the file must exist and be readable.\n\n"
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

if check_org ; then
  printf "that org cannot be validated.\n"
  CleanUp
  exit 1
fi

if check_env ; then
  printf "that env cannot be validated.\n"
  CleanUp
  exit 1
fi


baseurl=${mgmtserver}/v1/o/${orgname}/e/${envname}/keyvaluemaps

MYCURL -X GET ${baseurl}/${mapname}
if [[ ${CURL_RC} -eq 200 ]]; then
    printf "The map '%s' exists.\n" $mapname
    insert_kvm_entry
else
    printf "The map '%s' does not exist.\n" $mapname
fi

CleanUp
