/*
* Name: Internet Speed Meter
* Description: A simple and minimal internet speed meter extension for Gnome Shell.
* Author: Al Shakib
* GitHub: https://github.com/AlShakib/InternetSpeedMeter
* License: GPLv3.0
*/

const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib  = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;

const refreshTime = 1.0; // Set refresh time to one second.
const unitBase = 1024.0; // 1 GB == 1024MB or 1MB == 1024KB etc.
const units = ["KB/s", "MB/s", "GB/s", "TB/s"];

let prevUploadBytes = 0, prevDownloadBytes = 0;
let uploadSpeed = 0.0, downloadSpeed = 0.0;
let container, timeout, netSpeed, defaultNetSpeedText;
let home_dir = GLib.get_home_dir();
let logSize = 8000; // about 8k

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
    netSpeed.set_text( defaultNetSpeedText );
    saveExceptionLog(e);
  }
  return true;
}

function netSpeedFormat(speed) {
  let i = 0;
  while(speed >= unitBase) {  // Convert speed to KB, MB, GB or TB
    speed /= unitBase;
    i++;
  }
  return String(speed.toFixed(2) + " " + units[i]);
}

function saveExceptionLog(e){
  let log_file = Gio.file_new_for_path( 
    home_dir + '/.local/var/log/InternetSpeedMeter.log' );

  let log_file_size =  log_file.query_info( 
    'standard::size', 0, null).get_size();
  
  if( log_file_size > logSize ){
    log_file.replace( null,false, 0, null ).close(null);
  }
  e += Date()+':\n' + e;
  let logOutStream = log_file.append_to( 1, null );
  logOutStream.write( e, null );
  logOutStream.close(null);

}

function init() {
  container = new St.Bin({
    style_class: 'panel-button',
    reactive: true,
    can_focus: false,
    x_expand: true,
    y_expand: false,
    track_hover: false
  });
  defaultNetSpeedText = '⇅ -.-- --';
  netSpeed = new St.Label({
    text: defaultNetSpeedText ,
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
