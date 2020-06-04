/*
* Name: Internet Speed Meter
* Description: A simple and minimal internet speed meter extension for Gnome Shell.
* Author: Al Shakib
* GitLab: https://gitlab.com/AlShakib/InternetSpeedMeter
* License: GPLv3.0
*/

const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;

const refreshTime = 1.0; // Set refresh time to one second.
const unitBase = 1000.0; // 1 GB == 1000MB or 1MB == 1000KB etc.

let prevUploadBytes = 0, prevDownloadBytes = 0;
let uploadSpeed = 0.0, downloadSpeed = 0.0;
let container, timeout, netSpeed;

function getNetSpeed() {
  try {
    let file = Gio.file_new_for_path('/proc/net/dev');
    let fileStream = file.read(null);
    let dataStream = Gio.DataInputStream.new(fileStream);
    let uploadBytes = 0;
    let downloadBytes = 0;
    let line = '';
    while((line = dataStream.read_line(null)) != null) {
      line = String(line);
      line = line.trim();
      let column = line.split(/\W+/);
      if (column.length <= 2) break;
      if (column[0] != 'lo' &&
         !isNaN(parseInt(column[1])) &&
         !column[0].match(/^br[0-9]+/) &&
         !column[0].match(/^tun[0-9]+/) &&
         !column[0].match(/^tap[0-9]+/) &&
         !column[0].match(/^vnet[0-9]+/) &&
         !column[0].match(/^virbr[0-9]+/)) {
        uploadBytes = uploadBytes + parseInt(column[9]);
        downloadBytes = downloadBytes + parseInt(column[1]);
      }
    }
    fileStream.close(null);
    dataStream.close(null);
    if (prevUploadBytes === 0) {
      prevUploadBytes = uploadBytes;
    }
    if (prevDownloadBytes === 0) {
      prevDownloadBytes = downloadBytes;
    }

    // Current upload speed
    uploadSpeed = (uploadBytes - prevUploadBytes) / (refreshTime * unitBase);

    // Current download speed
    downloadSpeed = (downloadBytes - prevDownloadBytes) / (refreshTime * unitBase);

    // Show upload + download = total speed on shell
    netSpeed.set_text("⇅ " + netSpeedFormat(uploadSpeed + downloadSpeed));
    prevUploadBytes = uploadBytes;
    prevDownloadBytes = downloadBytes;
  } catch(e) {
    netSpeed.set_text(e.message);
  }
  return true;
}

function netSpeedFormat(speed) {
  let units = ["KB/s", "MB/s", "GB/s", "TB/s"];
  let i = 0;
  while(speed >= unitBase) {  // Convert speed to KB, MB, GB or TB
    speed /= unitBase;        // 1MB == 1000KB
    i++;
  }
  return String(speed.toFixed(2) + " " + units[i]);
}

function init() {
  container = new St.Bin({
    style_class: 'panel-button',
    reactive: true,
    can_focus: false,
    x_fill: true,
    y_fill: false,
    track_hover: false
  });
  netSpeed = new St.Label({
    text: '⇅ -.-- --',
    style_class: 'netSpeedLabel',
    y_align: Clutter.ActorAlign.CENTER
  });
  container.set_child(netSpeed);
}

function enable() {
  Main.panel._rightBox.insert_child_at_index(container, 0);
  timeout = Mainloop.timeout_add_seconds(refreshTime, getNetSpeed);
}

function disable() {
  Mainloop.source_remove(timeout);
  Main.panel._rightBox.remove_child(container);
}
