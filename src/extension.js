/*
 * Name: Internet Speed Meter
 * Description: A simple and minimal internet speed meter extension for Gnome Shell.
 * Author: Al Shakib
 * GitHub: https://github.com/AlShakib/InternetSpeedMeter
 * License: GPLv3.0
 */

import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class InternetSpeedMeter extends Extension {

  static refreshTimeInSeconds = 1;
  static unitBase = 1024.0; // 1 GB == 1024MB or 1MB == 1024KB etc.
  static units = ["KB/s", "MB/s", "GB/s", "TB/s", "PB/s", "EB/s"];
  static defaultNetSpeedText = "⇅ -.-- --";

  prevUploadBytes = 0;
  prevDownloadBytes = 0;
  container = null;
  netSpeedLabel = null;
  timeoutId = 0;

  // Read total download and upload bytes from /proc/net/dev file
  getBytes() {
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
        !column[0].match(/^proton[0-9]+/) &&
        !column[0].match(/^(veth|br-|docker0)[a-zA-Z0-9]+/)
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
  updateNetSpeed() {
    if (this.netSpeedLabel != null) {
      try {
        let bytes = this.getBytes();
        let downloadBytes = bytes[0];
        let uploadBytes = bytes[1];

        // Current upload speed
        let uploadSpeed = (uploadBytes - this.prevUploadBytes) / InternetSpeedMeter.unitBase;

        // Current download speed
        let downloadSpeed = (downloadBytes - this.prevDownloadBytes) / InternetSpeedMeter.unitBase;

        // Show upload + download = total speed on the shell
        this.netSpeedLabel.set_text(
          "⇅ " + this.getFormattedSpeed(uploadSpeed + downloadSpeed)
        );

        this.prevUploadBytes = uploadBytes;
        this.prevDownloadBytes = downloadBytes;
        return true;
      } catch (e) {
        log(`Can not fetch internet speed from /proc/net/dev: ${e}`);
        this.netSpeedLabel.set_text(InternetSpeedMeter.defaultNetSpeedText);
      }
    }
    return false;
  }

  // Format bytes to readable string
  getFormattedSpeed(speed) {
    let i = 0;
    while (speed >= InternetSpeedMeter.unitBase) {
      // Convert speed to KB, MB, GB or TB
      speed /= InternetSpeedMeter.unitBase;
      ++i;
    }
    return speed.toFixed(2) + " " + InternetSpeedMeter.units[i];
  }

  enable() {
    this.container = new St.Bin({
      reactive: true,
      can_focus: false,
      x_expand: true,
      y_expand: false,
      track_hover: false,
    });
    this.netSpeedLabel = new St.Label({
      text: InternetSpeedMeter.defaultNetSpeedText,
      style_class: "netSpeedLabel",
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.container.set_child(this.netSpeedLabel);
    Main.panel._rightBox.insert_child_at_index(this.container, 0);

    let bytes = this.getBytes();
    this.prevDownloadBytes = bytes[0];
    this.prevUploadBytes = bytes[1];

    this.timeoutId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      InternetSpeedMeter.refreshTimeInSeconds,
      this.updateNetSpeed.bind(this)
    );
  }

  disable() {
    if (this.timeoutId != 0) {
      GLib.Source.remove(this.timeoutId);
      this.timeoutId = 0;
    }
    if (this.container != null) {
      Main.panel._rightBox.remove_child(this.container);
      this.container.destroy();
      this.container = null;
    }
    this.netSpeedLabel = null;
  }
}
