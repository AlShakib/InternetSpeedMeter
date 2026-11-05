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
print_warning() { echo -e "${NC}[${YELLOW}!${NC}] ${1}${NC}"; echo "[!] ${1}" >> "$LOG_FILE"; }

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
        # GNOME Shell imports extension.js only once per session. Disable and
        # enable run the code that is already loaded, and only reload the
        # stylesheet.
        print_success "Extension disabled and enabled again."
        print_warning "Only stylesheet.css was reloaded. GNOME Shell loads extension.js once per session."
        print_info "To run changed code: log out and log in, or run: $0 --nested"
    else
        print_error "Failed to enable extension. Is it installed correctly?"
        print_info "Try running: gnome-extensions enable ${UUID}"
    fi
}

run_nested_shell() {
    local shell_args
    if gnome-shell --help 2>&1 | grep -q -- '--devkit'; then
        # GNOME 49 and later removed --nested. --devkit shows the new shell
        # in the mutter-devkit window.
        if [[ ! -x /usr/libexec/mutter-devkit ]]; then
            print_error "mutter-devkit is not installed."
            print_info "Install it (Fedora: sudo dnf install mutter-devkit), then run $0 --nested again."
            exit 1
        fi
        shell_args=(--devkit)
    else
        shell_args=(--nested --wayland)
    fi

    install_extension

    print_info "Starting a nested GNOME Shell: gnome-shell ${shell_args[*]}"
    print_info "Close its window to stop it. Its log is in ${LOG_FILE}."
    # A separate D-Bus session keeps the nested shell apart from the running
    # one. It reads the same dconf settings, so the extension is enabled in
    # it, and it imports the newly installed extension.js.
    MUTTER_DEBUG_DUMMY_MODE_SPECS=1366x768 \
        dbus-run-session -- gnome-shell "${shell_args[@]}" &>> "$LOG_FILE"
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
    -n|--nested)
        run_nested_shell
        ;;
    *)
        echo "Usage: $0 {-i|--install | -b|--build | -r|--reload | -n|--nested}"
        exit 1
        ;;
esac
