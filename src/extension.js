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

const refreshTime = 1.0; // Set refresh time to one second.
const unitBase = 1024.0; // 1 GB == 1024MB or 1MB == 1024KB etc.
const units = ["KB/s", "MB/s", "GB/s", "TB/s"];
const defaultNetSpeedText = '⇅ -.-- --';

let prevUploadBytes = 0, prevDownloadBytes = 0;
let containerButton, netSpeedLabel, refreshLoop;

function updateNetSpeed() {
  if (netSpeedLabel) {
    try {
      let lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split('\n');
      let uploadBytes = 0;
      let downloadBytes = 0;
      let line;
      for (let i = 0; i < lines.length; ++i) {
        line = lines[i].trim();
        let column = line.split(/\W+/);
        if (column.length <= 2) break;
        if (column[0] != 'lo' &&
          !isNaN(parseInt(column[1])) &&
          !column[0].match(/^br[0-9]+/) &&
          !column[0].match(/^tun[0-9]+/) &&
          !column[0].match(/^tap[0-9]+/) &&
          !column[0].match(/^vnet[0-9]+/) &&
          !column[0].match(/^virbr[0-9]+/)) {
          uploadBytes += parseInt(column[9]);
          downloadBytes += parseInt(column[1]);
        }
      }

      // Current upload speed
      let uploadSpeed = (uploadBytes - prevUploadBytes) / (refreshTime * unitBase);

      // Current download speed
      let downloadSpeed = (downloadBytes - prevDownloadBytes) / (refreshTime * unitBase);

      // Show upload + download = total speed on the shell
      netSpeedLabel.set_text("⇅ " + getFormattedSpeed(uploadSpeed + downloadSpeed));

      prevUploadBytes = uploadBytes;
      prevDownloadBytes = downloadBytes;
      return true;
    } catch (e) {
      netSpeedLabel.set_text(defaultNetSpeedText);
    }
  }
  return false;
}

function getFormattedSpeed(speed) {
  let i = 0;
  while (speed >= unitBase) {  // Convert speed to KB, MB, GB or TB
    speed /= unitBase;
    i++;
  }
  return String(speed.toFixed(2) + " " + units[i]);
}

function enable() {
  containerButton = new St.Bin({
    style_class: 'panel-button',
    reactive: true,
    can_focus: false,
    x_expand: true,
    y_expand: false,
    track_hover: false
  });
  netSpeedLabel = new St.Label({
    text: defaultNetSpeedText,
    style_class: 'netSpeedLabel',
    y_align: Clutter.ActorAlign.CENTER
  });
  containerButton.set_child(netSpeedLabel);

  Main.panel._rightBox.insert_child_at_index(containerButton, 0);
  refreshLoop = Mainloop.timeout_add_seconds(refreshTime, updateNetSpeed);
}

function disable() {
  if (refreshLoop) {
    Mainloop.source_remove(refreshLoop);
    refreshLoop = null
  }
  if (containerButton) {
    Main.panel._rightBox.remove_child(containerButton);
    containerButton.destroy();
    containerButton = null;
  }
  if (netSpeedLabel) {
    netSpeedLabel.destroy();
    netSpeedLabel = null;
  }
}
