#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# Created: <Mon Mar  4 17:55:18 2019>
# Last Updated: <2019-March-05 09:25:08>
#

scriptname=${0##*/}
orgname=""
envname=""
defaultmgmtserver="https://api.enterprise.apigee.com"
version="20190305-0925"
verbosity=1
netrccreds=0
removeit=0
credentials=""

usage() {
  local CMD=`basename $0`
  echo "$CMD:"
  echo "  Management for named resources (xsl, wsdl, etc) in an environment or org."
  echo "  Uses the curl utility."
  echo "usage:"
  echo "  $CMD [options]"
  echo "  version: ${version}"
  echo "options: "
  echo "  -m url    optional. the base url for the mgmt server. default: $defaultmgmtserver"
  echo "  -o org    required. the org to use."
  echo "  -e env    optional. the environment to use. default: ${envname}"
  echo "  -u creds  optional. http basic authn credentials for the Admin API calls."
  echo "  -T token  optional. bearer token to use for the Admin API calls."
  echo "  -n        optional. tells curl to use .netrc to retrieve credentials"
  echo "  -F file   optional. resource file to upload. Use with -A C . "
  echo "  -N name   optional. resource file to delete. Use with -A D ."
  echo "  -t type   optional. type of resource file - xsd, xsl, wsdl, jsc, etc."
  echo "  -A action required. C = create (or update).  D = delete. L = list."
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
  [[ -z "${CURL_OUT}" ]] && CURL_OUT=`mktemp /tmp/apigee-${scriptname}.curl.out.XXXXXX`
  [[ -f "${CURL_OUT}" ]] && rm ${CURL_OUT}
  [[ $verbosity -gt 0 ]] && echo "curl $@"

  # run the curl command
  CURL_RC=`curl "${credentials[@]}" -s -w "%{http_code}" -o "${CURL_OUT}" "$@"`
  [[ $verbosity -gt 0 ]] && echo "==> ${CURL_RC}"
}

CleanUp() {
  [[ -f ${CURL_OUT} ]] && rm -rf ${CURL_OUT}
}

choose_credentials() {
  local username password

  read -p "username for Edge org ${org} at ${mgmtserver} ? (blank to use .netrc): " username
  echo
  if [[ "$username" = "" ]] ; then  
    credentials=("-n")
  else
    echo -n "Org Admin Password: "
    read -s password
    echo
    credentials=("-u" "${username}:${password}")
  fi
}

maybe_ask_password() {
  local password
  if [[ ${credentials} =~ ":" ]]; then
    credentials=("-u" "${credentials}")
  else
    echo -n "password for ${credentials}?: "
    read -s password
    echo
    credentials=("-u" "${credentials}:${password}")
  fi
}

check_org() {
  [[ $verbosity -gt 0 ]] && echo "checking org ${orgname}..."
  MYCURL -X GET  ${mgmtserver}/v1/o/${orgname}
  [[ ${CURL_RC} -ne 200 ]]
}

isResourceExists() {
  [[ $verbosity -gt 0 ]] && echo "checking resource ${shortfilename}..."
  MYCURL -X GET ${urlbase}/${resourcetype}/${shortfilename}
  [[ ${CURL_RC} -eq 200 ]]
}

isValidResourceType() {
   [[ "wsdl jsc xsd xsl py java node" =~ (^|[[:space:]])$resourcetype($|[[:space:]]) ]]
}

invalidAction() {
   [[ ! "C D L" =~ (^|[[:space:]])$action($|[[:space:]]) ]]
}


validateResourceType() {
  if [[ "X$resourcetype" = "X" ]]; then
      resourcetype="${shortfilename##*.}"
  fi

  if isValidResourceType ; then
      printf "valid resource type\n"
  else
    printf "invalid resource type: %s\n" $resourcetype
    CleanUp
    exit 1
  fi
}

deleteResource() {
  validateResourceType
  if isResourceExists ; then
      # delete existing resource
      MYCURL -X DELETE ${urlbase}/${resourcetype}/$shortfilename 
  else
    printf "resource does not exist\n"
    CURL_RC=0
  fi
}

createResource() {
  validateResourceType
  if isResourceExists ; then
      # Replace existing resource
      MYCURL -X PUT ${urlbase}/${resourcetype}/$shortfilename -H "content-type:application/octet-stream" -d @$resourcefile
  else
    # create a new resource
    MYCURL -X POST "${urlbase}?type=${resourcetype}&name=$shortfilename" -H "content-type:application/octet-stream" -d @$resourcefile
  fi
}

listResources() {
  MYCURL -X GET ${urlbase}
  cat ${CURL_OUT}
}

setUrlBase() {
  urlbase=$mgmtserver/v1/o/$orgname
  if [[ ! "X$envname" = "X" ]]; then
      urlbase=$urlbase/e/$envname
  fi
  urlbase=$urlbase/resourcefiles
}

#========================================================================================

while getopts "hm:o:e:F:N:t:A:u:T:nv" opt; do
  case $opt in
    h) usage ;;
    m) mgmtserver=$OPTARG ;;
    o) orgname=$OPTARG ;;
    e) envname=$OPTARG ;;
    F) resourcefile=$OPTARG ;;
    N) shortfilename=$OPTARG ;;
    t) resourcetype=$OPTARG ;;
    A) action=$OPTARG ;;
    u) credentials="-u $OPTARG" ;;
    T) bearertoken=$OPTARG ;;
    n) netrccreds=1 ;;
    v) verbosity=$(($verbosity+1)) ;;
    *) echo "unknown arg: $opt" && usage ;;
  esac
done

echo
# Validations
if invalidAction ; then
    printf "You must specify a valid action (-A).\n\n"
    usage
    exit 1
fi

if [[ "X$mgmtserver" = "X" ]]; then
  mgmtserver="$defaultmgmtserver"
fi

if [[ "X$orgname" = "X" ]]; then
    printf "You must specify an org name (-o).\n\n"
    usage
    exit 1
fi

if [[ "X$credentials" = "X" ]]; then
    if [[ "X$bearertoken" = "X" ]]; then
        if [[ ${netrccreds} -eq 1 ]]; then
            credentials='-n'
        else
          choose_credentials
        fi 
    else
      credentials=('-H' 'Authorization: Bearer '$bearertoken)
    fi
else
  maybe_ask_password
fi

if [[ "${action}" = "D" ]]; then
    if [[ "X$shortfilename" = "X" ]]; then
        printf "You must specify a resource name (-N).\n\n"
        usage
        exit 1
    fi
elif [[ "${action}" = "C" ]]; then
    if [[ "X$resourcefile" = "X" ]]; then
        printf "You must specify a resource file (-F).\n\n"
        usage
        exit 1
    fi
    if [[ ! -f "$resourcefile" ]]; then
        printf "The resourcefile must exist.\n\n"
        usage
        exit 1
    fi
    shortfilename=$(basename -- "$resourcefile")
fi

if check_org ; then
    printf "that org cannot be validated.\n"
    cat ${CURL_OUT}
  CleanUp
  exit 1
fi

# Execution

setUrlBase

case $action in
  "D") deleteResource ;;
  "C") createResource ;;
  "L") listResources ;;
  *) printf "invalid action\n" && exit 1 ;;
esac


if [[ ${CURL_RC} -eq 200 || ${CURL_RC} -eq 201 ]]; then
    printf "\nok\n"
else
  printf "\nfailed\n"
  cat ${CURL_OUT}
fi

CleanUp

