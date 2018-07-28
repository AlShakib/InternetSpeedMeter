/*
* Name: Internet Speed Meter
* Version: 1.0
* Description: A simple internet speed meter extension for gnome shell.
* Author: @TH3L0N3C0D3R
* GitLab: https://gitlab.com/TH3L0N3C0D3R/Internet-Speed-Meter
* License: GPLv3.0
*/

const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const refreshTime = 1.0;

let prevBytes = 0.0, prevSpeed = 0.0;

function getNetSpeed() {
  try {
    let file = Gio.file_new_for_path('/proc/net/dev');
    let fileStream = file.read(null);
    let dataStream = Gio.DataInputStream.new(fileStream);
    let bytes = 0;
    let line;
    while(line = dataStream.read_line(null)) {
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
        bytes = bytes + parseInt(column[1]) + parseInt(column[9]);
      }
    }
    fileStream.close(null);
    if (prevBytes === 0.0) {
      prevBytes = bytes;
    }
    let speed = (bytes - prevBytes) / (refreshTime * 1000.0); // To skip Bytes/Sec.
    netSpeed.set_text(netSpeedFormat(speed))
    prevBytes = bytes;
    prevSpeed = speed;
  } catch(e) {
    netSpeed.set_text(e.message);
  }
  return true;
}

function netSpeedFormat(speed) {
  let units = ["KB", "MB", "GB", "TB"];
  if (speed === 0.0) {
    return "⇅ 0.00 " + units[0];
  }
  let i = 0;
  while(speed >= 1000.0) {  // Convert KB, MB, GB, TB
    speed /= 1000.0;        // 1 MB = 1000 KB
    i++;
  }
  return String("⇅ " + speed.toFixed(2) + " " + units[i]);
}

let button, timeout, netSpeed;
function init() {
  button = new St.Bin({
    style_class: 'panel-button',
    reactive: true,
    can_focus: false,
    x_fill: true,
    y_fill: false,
    track_hover: false
  });
  netSpeed = new St.Label({
    text: '⇅ -.-- --',
    style_class: 'netSpeedLabel'
  });
  button.set_child(netSpeed);
}

function enable() {
  Main.panel._rightBox.insert_child_at_index(button, 0);
  timeout = Mainloop.timeout_add_seconds(refreshTime, getNetSpeed);
}

function disable() {
  Mainloop.source_remove(timeout);
  Main.panel._rightBox.remove_child(button);
}
