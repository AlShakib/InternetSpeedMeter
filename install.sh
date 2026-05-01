#!/usr/bin/env bash

# --- Configuration ---
UUID="InternetSpeedMeter@alshakib.dev"
SRC_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
EXTENSION_SRC="${SRC_DIR}/src"
OUT_DIR="${SRC_DIR}/out"
LOG_DIR="${SRC_DIR}/log"
LOG_FILE="${LOG_DIR}/build.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "${LOG_DIR}"
echo -e "\n--- Build started: $(date '+%Y-%m-%d %H:%M:%S') ---" >> "${LOG_FILE}"

# --- Helpers ---
print_info() { echo -e "${NC}[+] ${1}${NC}"; echo "[+] ${1}" >> "$LOG_FILE"; }
print_success() { echo -e "${NC}[${GREEN}✔${NC}] ${1}${NC}"; echo "[✔] ${1}" >> "$LOG_FILE"; }
print_error() { echo -e "${NC}[${RED}x${NC}] ${1}${NC}"; echo "[x] ${1}" >> "$LOG_FILE"; }

# --- Actions ---

install_extension() {
    local install_path="${HOME}/.local/share/gnome-shell/extensions"
    if [[ "$(id -u)" -eq 0 ]]; then install_path="/usr/share/gnome-shell/extensions"; fi
    local target_dir="${install_path}/${UUID}"

    print_info "Installing files..."
    mkdir -p "${install_path}"
    rm -rf "${target_dir}"
    cp -rf "${EXTENSION_SRC}" "${target_dir}" &>> "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        print_success "Files copied to ${target_dir}"
    else
        print_error "Installation failed."
        exit 1
    fi
}

reload_extension() {
    install_extension

    print_info "Reloading ${UUID}..."

    # Disable the extension
    gnome-extensions disable "${UUID}" &>> "$LOG_FILE"

    # Give the shell a moment to process the removal
    sleep 0.5

    # Enable the extension
    gnome-extensions enable "${UUID}" &>> "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        print_success "Extension reloaded successfully!"
    else
        print_error "Failed to enable extension. Is it installed correctly?"
        print_info "Try running: gnome-extensions enable ${UUID}"
    fi
}

build_zip() {
    print_info "Building release ZIP..."
    mkdir -p "${OUT_DIR}"
    local zip_file="${OUT_DIR}/${UUID}.zip"
    rm -f "${zip_file}"
    (cd "${EXTENSION_SRC}" && zip -r "${zip_file}" . -x "*.DS_Store" "*.git*") &>> "$LOG_FILE"
    [[ $? -eq 0 ]] && print_success "Zip created at ${zip_file}" || print_error "Zip failed."
}

# --- Execution ---
case "${1}" in
    -b|--build)
        build_zip
        ;;
    -r|--reload)
        reload_extension
        ;;
    -i|--install)
        install_extension
        ;;
    *)
        echo "Usage: $0 {-i|--install | -b|--build | -r|--reload}"
        exit 1
        ;;
esac
