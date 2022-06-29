#!/bin/bash
# -*- mode:shell-script; coding:utf-8; -*-
#
# example usage:
#  xloadFileIntoKvm.sh -t $TOKEN -o orgname -e envname -F sampledata/filename.json -N entryname  -M mapname
#
# Created: <Thu Aug  3 14:05:20 2017>
# Last Updated: <2022-June-29 14:48:11>
#

scriptname=${0##*/}
orgname=""
envname=""
mapname=""
datafilename=""
kvmentryname=""
mgmtserver="https://apigee.googleapis.com"
version="20220623-0959"
verbosity=1

usage() {
  local CMD=`basename $0`
  echo "$CMD:"
  echo "  Loads a file into an entry within an environment-scoped KVM."
  echo "  Uses the curl utility."
  echo "usage:"
  echo "  $CMD [options]"
  echo "  version: ${version}"
  echo "options: "
  echo "  -t token  required. the token to use to authenticate to the Apigee API."
  echo "  -o org    required. the org to use."
  echo "  -e env    required. the environment to use."
  echo "  -M map    required. KVM Map name. The map must exist."
  echo "  -N name   required. name to use for the entry within KVM."
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
  [[ -z "${CURL_OUT}" ]] && CURL_OUT=`mktemp /tmp/apigee-${scriptname}.curl.out.XXXXXX`
  [[ -f "${CURL_OUT}" ]] && rm ${CURL_OUT}
  if [[ $verbosity -gt 1 ]]; then
      echo "curl $@"
  elif [[ $verbosity -gt 0 ]]; then
      echo "curl $@" | tr -d "\n" | sed -E 's/ -d.+/ -d ... /'
      echo
  fi

  # run the curl command
  CURL_RC=`curl -H "Authorization: Bearer $token" -s -w "%{http_code}" -o "${CURL_OUT}" "$@"`
  [[ $verbosity -gt 0 ]] && echo "==> ${CURL_RC}"
}

check_org() {
  [[ $verbosity -gt 0 ]] && echo "checking org ${orgname}..."
  MYCURL -X GET ${baseurl}
  [[ ${CURL_RC} -ne 200 ]]
}

check_env() {
  [[ $verbosity -gt 0 ]] && echo "checking env ${envname}..."
  MYCURL -X GET ${baseurl}/environments/${envname}
  [[ ${CURL_RC} -ne 200 ]]
}

check_map() {
  local kvms
  [[ $verbosity -gt 0 ]] && echo "checking map ${mapname}..."
  MYCURL -X GET ${baseurl}/environments/${envname}/keyvaluemaps
  [[ ${CURL_RC} -ne 200 ]] && return 1
  kvms=(`cat ${CURL_OUT} | sed -E 's/[]",[]//g'`)
  local rstatus=0
  for i in "${!kvms[@]}";  do
      if [[ "$mapname" == "${kvms[i]}" ]]; then
          rstatus=1 # found
      fi
  done
  return $rstatus
}

kvm_entry_exists() {
    MYCURL -X GET ${baseurl}/environments/${envname}/keyvaluemaps/${mapname}/entries/${kvmentryname}
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
    local file_contents=$(cat "$datafilename")
    # This looks like a no-op, but actually it double-escape newlines.
    file_contents="${file_contents//$'\\\\n'/\\\\n}"
    # Also, we need to do the right thing for quotes in the file contents. This
    # is especially relevant for JSON files.
    file_contents=`echo -n ${file_contents} | sed 's/"/\\\"/g'`
    payload=$'{\n'
    payload+=$'  "name" : "'$kvmentryname$'",\n'
    payload+=$'  "value" : "'
    payload+="${file_contents}"
    payload+=$'"\n'
    payload+=$'}'
    # echo $payload
    # There is no update API.  The way to update an entry is delete-then-create.
    if kvm_entry_exists ; then
        # Delete first
        MYCURL -X DELETE ${baseurl}/environments/${envname}/keyvaluemaps/${mapname}/entries/$kvmentryname
    fi

    # Create
    MYCURL -X POST ${baseurl}/environments/${envname}/keyvaluemaps/${mapname}/entries \
           -H content-type:application/json \
           -d "${payload}"

    #cat ${CURL_OUT}
    printf "\n\n"
}

#========================================================================================

while getopts "ht:o:e:M:F:N:" opt; do
  case $opt in
    h) usage ;;
    t) token=$OPTARG ;;
    o) orgname=$OPTARG ;;
    e) envname=$OPTARG ;;
    M) mapname=$OPTARG ;;
    F) datafilename=$OPTARG ;;
    N) kvmentryname=$OPTARG ;;
    *) echo "unknown arg" && usage ;;
  esac
done

messages=()

[[ "X$orgname" = "X" ]] && messages+=("You must specify an org name (-o).")
[[ "X$token" = "X" ]] && messages+=("You must specify a token (-t).")
[[ "X$envname" = "X" ]] && messages+=("You must specify an environment (-e).")
[[ "X$mapname" = "X" ]] && messages+=("You must specify a map name (-M).")
[[ "X$kvmentryname" = "X" ]] && messages+=("You must specify a name for the KVM entry (-N).")
[[ "X$datafilename" = "X" || ! -r "$datafilename" ]] && messages+=("You must specify a file (-F) and the file must exist and be readable.")

num_messages=${#messages[@]}
if [[ $num_messages -gt 0 ]]; then
    for (( i=0; i<$num_messages; i++ )); do
        printf "%s\n" "${messages[$i]}"
    done
    exit 1
fi

baseurl=${mgmtserver}/v1/organizations/${orgname}

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
if check_map ; then
  printf "that map does not exist.\n"
  CleanUp
  exit 1
fi


insert_kvm_entry

CleanUp
exit $status
