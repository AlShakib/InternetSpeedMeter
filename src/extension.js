/*
 * Name: Internet Speed Meter
 * Description: A simple and minimal internet speed meter extension for Gnome Shell.
 * Author: Al Shakib
 * GitHub: https://github.com/AlShakib/InternetSpeedMeter
 * License: GPLv3.0
 */

const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;

const refreshTimeInSeconds = 1;
const unitBase = 1024.0; // 1 GB == 1024MB or 1MB == 1024KB etc.
const units = ["KB/s", "MB/s", "GB/s", "TB/s", "PB/s", "EB/s"];
const defaultNetSpeedText = "⇅ -.-- --";

let prevUploadBytes = 0;
let prevDownloadBytes = 0;
let container = null;
let netSpeedLabel = null;
let timeoutId = 0;

// Read total download and upload bytes from /proc/net/dev file
function getBytes() {
  let lines = Shell.get_file_contents_utf8_sync("/proc/net/dev").split("\n");
  let downloadBytes = 0;
  let uploadBytes = 0;
  for (let i = 0; i < lines.length; ++i) {
    let column = lines[i].trim().split(/\W+/);
    if (column.length <= 2) {
      break;
    }
    if (
      !column[0].match(/^lo$/) &&
      !column[0].match(/^br[0-9]+/) &&
      !column[0].match(/^tun[0-9]+/) &&
      !column[0].match(/^tap[0-9]+/) &&
      !column[0].match(/^vnet[0-9]+/) &&
      !column[0].match(/^virbr[0-9]+/) &&
      !column[0].match(/^docker[0-9]+/) 
    ) {
      let download = parseInt(column[1]);
      let upload = parseInt(column[9]);
      if (!isNaN(download) && !isNaN(upload)) {
        downloadBytes += download;
        uploadBytes += upload;
      }
    }
  }
  return [downloadBytes, uploadBytes];
}

// Update current net speed to shell
function updateNetSpeed() {
  if (netSpeedLabel != null) {
    try {
      let bytes = getBytes();
      let downloadBytes = bytes[0];
      let uploadBytes = bytes[1];

      // Current upload speed
      let uploadSpeed = (uploadBytes - prevUploadBytes) / unitBase;

      // Current download speed
      let downloadSpeed = (downloadBytes - prevDownloadBytes) / unitBase;

      // Show upload + download = total speed on the shell
      netSpeedLabel.set_text(
        "⇅ " + getFormattedSpeed(uploadSpeed + downloadSpeed)
      );

      prevUploadBytes = uploadBytes;
      prevDownloadBytes = downloadBytes;
      return true;
    } catch (e) {
      log(`Can not fetch internet speed from /proc/net/dev: ${e}`);
      netSpeedLabel.set_text(defaultNetSpeedText);
    }
  }
  return false;
}

// Format bytes to readable string
function getFormattedSpeed(speed) {
  let i = 0;
  while (speed >= unitBase) {
    // Convert speed to KB, MB, GB or TB
    speed /= unitBase;
    ++i;
  }
  return speed.toFixed(2) + " " + units[i];
}

// This function is called once when your extension is loaded, not enabled. This
// is a good time to setup translations or anything else you only do once.
//
// You MUST NOT make any changes to GNOME Shell, connect any signals or add any
// MainLoop sources here.
function init() { }

// This function could be called after your extension is enabled, which could
// be done from GNOME Tweaks, when you log in or when the screen is unlocked.
//
// This is when you setup any UI for your extension, change existing widgets,
// connect signals or modify GNOME Shell's behaviour.
function enable() {
  container = new St.Bin({
    reactive: true,
    can_focus: false,
    x_expand: true,
    y_expand: false,
    track_hover: false,
  });
  netSpeedLabel = new St.Label({
    text: defaultNetSpeedText,
    style_class: "netSpeedLabel",
    y_align: Clutter.ActorAlign.CENTER,
  });
  container.set_child(netSpeedLabel);
  Main.panel._rightBox.insert_child_at_index(container, 0);

  let bytes = getBytes();
  prevDownloadBytes = bytes[0];
  prevUploadBytes = bytes[1];

  timeoutId = Mainloop.timeout_add_seconds(
    refreshTimeInSeconds,
    updateNetSpeed
  );
}

// This function could be called after your extension is uninstalled, disabled
// in GNOME Tweaks, when you log out or when the screen locks.
//
// Anything you created, modifed or setup in enable() MUST be undone here. Not
// doing so is the most common reason extensions are rejected during review!
function disable() {
  if (timeoutId != 0) {
    Mainloop.source_remove(timeoutId);
    timeoutId = 0;
  }
  if (container != null) {
    Main.panel._rightBox.remove_child(container);
    container.destroy();
    container = null;
  }
  netSpeedLabel = null;
}
