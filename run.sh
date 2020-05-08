#!/usr/bin/bash

# Ensure we are in this file's directory
cd "$( dirname "${BASH_SOURCE[0]}" )"

# Some pretty colors and tags
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'
DONE="\r[ ${GREEN}DONE${NC} ]\n"
WARNING="\r[ ${YELLOW}WARN${NC} ]"
ERROR="\r[ ${RED}ERROR${NC} ]"
T="\t "

function error {
	printf "${ERROR} ${1}"
	for c in {1..100}; do printf ' '; done
	echo ''
	rm -rf dependencies
	[ -n $2 ] && $2
	exit 1
}

function wait_seq {

	i=0
	DESC=false
	while true; do
	
		[ $i -eq 5 ] && DESC=true
		[ $i -eq 0 ] && DESC=false

		printf '\r['
		for c in $(seq 1 $i); do printf ' '; done
		printf "*"
		for c in $(seq 1 $(( 5-$i ))); do printf ' '; done
		printf -- "$END]"
		sleep .1

		if [ $DESC = 'true' ]; then ((--i))
		else ((++i)); fi
	done
}

function hold {
	wait_seq &
	WAIT_PID=$!
	$1 >/dev/null 2>&1
	[ STATUS=$? ] && kill $WAIT_PID
	return $STATUS
}

uncomment() {
	sed -i "/${1}/s/^#//g" ${2}
}

# Get your recommended mirror from apache.org
function get_mirror {
	printf "${T}Fetching your mirror..."
	hold "curl -so mirrors.txt http://ws.apache.org/mirrors.cgi"
	MIRROR=$(grep -E '<p><a href=.*</strong></a>' mirrors.txt | cut -d '"' -f 2)
	rm mirrors.txt
	printf "$DONE"
}

# Attempt to extract the provided archive into the dependency directory gracefully
function handle_archive {
	[ ! -f $1 ] && return 1
	tar -xzf $1 -C dependencies/ 2> /dev/null
	# If any errors occur, they will be caught by the caller
}

# Download the provided file from the mirror site and extract it into dependencies/
function get_dependency {

	# The parameter comes in 'name-1.2.3' format. Here, we extract the name 
	NAME=(${1//-/ })
	ARCHIVE=/tmp/${1}.tar.gz
	printf "${T}Fetching ${NAME}..."
	
	handle_archive $ARCHIVE
	[ $? -ne 0 ] && {
		# The previous unzipping attempt failed, redownload and try again
		rm -f $ARCHIVE
		hold "curl -so $ARCHIVE ${MIRROR}/${NAME}/${1}.tar.gz"
		[ $? -ne 0 ] && error "Unable to download ${1}"
		handle_archive $ARCHIVE
		[ $? -ne 0 ] && error "Unable to extract ${1}"
	}
	printf "$DONE"
}

function install_dependency {
	
	mkdir dependencies/$1
	PREFIX="$(pwd)/dependencies/$1"
	cd dependencies/$1-*

	printf "${T}Setting up ${1}..."
	hold "./configure --prefix=$PREFIX ${2}"
	[ $? -ne 0 ] && error "Unable to set up ${1}"
	printf "$DONE"
	printf "${T}Building ${1}..."
	hold "make"
	[ $? -ne 0 ] && error "Unable to build ${1}"
	printf "$DONE"
	printf "${T}Installing ${1}..."
	hold "make install"
	[ $? -ne 0 ] && error "Unable to install ${1}"
	printf "$DONE"
	printf "${T}Removing source directory..."
	cd ../
	rm -rf httpd-*
	cd httpd
	printf "$DONE"
}

# download Apache HTTPD to serve web pages
function get_dependencies {
	cd "$( dirname "${BASH_SOURCE[0]}" )"

	rm -rf dependencies
	mkdir dependencies
	
	get_mirror

	get_dependency httpd-2.4.43
	install_dependency httpd --enable-so
	httpd_config

}

# generate a config file
function httpd_config {
	cd "$( dirname "${BASH_SOURCE[0]}" )"
	printf "${T}Configuring httpd..."
	CONF=$(pwd)/conf/httpd.conf
	uncomment mod_proxy.so $CONF
	uncomment mod_proxy_http.so $CONF
	uncomment mod_proxy_connect.se $CONF
	uncomment 'ServerName www.example.com' $CONF
	sed -i "s|www.example.com:80|127.0.0.1:80|g" $CONF
	sed -i "s|dependencies/httpd/htdocs|client|g" $CONF
	sed -i "s|daemon|$USER|g" $CONF
	echo "ProxyPass			/api	http://localhost:8081
	ProxyPassReverse	/api	http://localhost:8081" >> $CONF
	printf "$DONE"
}

function gen_config {
	echo 'Not implemented'
}

function reset {
	get_dependencies
	#gen_config - not yet implemented
	exit 0
}

function server {
	cd "$( dirname "${BASH_SOURCE[0]}" )"
	sudo ./dependencies/httpd/bin/apachectl $1
}

function print_help {
	printf "\n${BLUE}HOW TO USE THIS SCRIPT:${NC}\n"
	echo "--help          [-h] : Display this prompt"
	echo "--reset         [-r] : Re-install all dependencies and reset all config files"
	echo "--dependencies  [-d] : Re-install all dependencies"
	echo "--config        [-c] : reset all config files"
	echo "--server [cmd]  [-s] : Run an apachectl command"
	echo "    example: ./run.sh -s status (returns status of the server)"
	echo "________________________________________________________________________________________________"
}

declare -A COMMANDS=([-h]=print_help [--help]=print_help \
					[-s]=server [--server]=server \
					[-r]=reset [--reset]=reset \
					[-d]=get_dependencies [--dependencies]=get_dependencies \
					[-c]=gen_config [--config]=gen_config)

[ -z $1 ] && reset
for (( i=1; i<=$#; i++)); do
	NEXT=${COMMANDS[${!i}]}

	[ -z "${NEXT}" ] && error "Invalid flag: ${ARG}" print_help

	[ "${NEXT}" = "server" ] && {
		cmd=$((++i))
		$NEXT ${!cmd}
		continue
	}

	$NEXT
done
