#!/usr/bin/env bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
SRC_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )";
LOG_DIR="${SRC_DIR}/log"
LOG_FILE="${LOG_DIR}/build.log";
mkdir -p "${LOG_DIR}"
if [[ -f "${LOG_FILE}" ]]; then
  echo '' >> "${LOG_FILE}"
  echo "$(date '+%d/%m/%Y %H:%M:%S')" >> "${LOG_FILE}"
  echo '' >> "${LOG_FILE}"
else
  touch "${LOG_FILE}"
  echo "$(date '+%d/%m/%Y %H:%M:%S')" >> "${LOG_FILE}"
  echo '' >> "${LOG_FILE}"
fi

INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions"
if [[ "$(id -u)" -eq 0 ]]; then
  chown "${SUDO_USER}":"${SUDO_USER}" -R "${LOG_DIR}"
  INSTALL_DIR="/usr/share/gnome-shell/extensions"
fi

# print <arg>
print() {
  echo -e "${NC}[+] ${1}${NC}"
  echo -e "[+] ${1}" &>> "$LOG_FILE"
}

# print_warning <arg>
print_warning() {
  echo -e "${NC}[${YELLOW}!${NC}] ${1}${NC}"
  echo -e "[!] ${1}" &>> "$LOG_FILE"
}

# print_failed <arg>
print_failed() {
  echo -e "${NC}[${RED}x${NC}] ${1}${NC}"
  echo -e "[x] ${1}" &>> "$LOG_FILE"
}

# print_success <arg>
print_success() {
  echo -e "${NC}[${GREEN}\xE2\x9C\x94${NC}] ${1}${NC}"
  echo -e "[✔] ${1}" &>> "$LOG_FILE"
}

# print_suggestion <arg>
print_suggestion() {
  echo -e "${NC}[${BLUE}#${NC}] ${1}${NC}"
  echo -e "[#] ${1}" &>> "$LOG_FILE"
}

# is_failed <success_message> <failed_message>
is_failed() {
  if [[ "$?" -eq 0 ]]; then
    print_success "${1}"
  else
    print_failed "${2}"
  fi
}

# is_warning <success_message> <warning_message>
is_warning() {
  if [[ "$?" -eq 0 ]]; then
    print_success "${1}"
  else
    print_warning "${2}"
  fi
}

# install extension
install() {
  print "Installing to ${INSTALL_DIR}"
  mkdir -p "${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR}/InternetSpeedMeter@alshakib.dev"
  cp -rf "${SRC_DIR}/src" "${INSTALL_DIR}/InternetSpeedMeter@alshakib.dev" &>> "$LOG_FILE"
  is_failed "Done" "Skipping: Can not install to ${INSTALL_DIR}. See log for more info."
}

# build for release
build() {
  print "Creating InternetSpeedMeter@alshakib.dev.zip"
  mkdir -p "${SRC_DIR}/out"
  zip -6rXj "$SRC_DIR/out/InternetSpeedMeter@alshakib.dev.zip" "src" &>> "$LOG_FILE"
  is_failed "Done" "Skipping: Creating zip is failed. See log for more info."
}

# Let's start
if [[ "${1}" == "-b" ]]; then
  build
else
  install
fi
