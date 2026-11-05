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

  previousBytesByInterface = new Map();
  container = null;
  netSpeedLabel = null;
  timeoutId = 0;

  // Only physical network devices have a "device" link in sysfs. Virtual
  // interfaces (loopback, bridges, VPN tunnels, WireGuard, Tailscale, Docker,
  // libvirt) do not. Their traffic also goes through a physical device, so
  // counting them would count the same bytes twice. A list of name patterns
  // can not do this reliably, because a WireGuard or VPN interface can have
  // any name.
  isPhysicalInterface(interfaceName) {
    return GLib.file_test(
      `/sys/class/net/${interfaceName}/device`,
      GLib.FileTest.EXISTS
    );
  }

  // Read the total received + transmitted bytes of each physical interface
  // from /proc/net/dev. Returns null if the file can not be read.
  //
  // A data line looks like "  eth0: <rx bytes> <7 rx fields> <tx bytes> ...".
  // Interface names can contain "-" and "." (br-1a2b3c, eth0.100), but the
  // kernel does not allow ":" or whitespace in them. So split the name off at
  // the first colon and split only the counters on whitespace.
  getBytesByInterface() {
    let lines;
    try {
      lines = Shell.get_file_contents_utf8_sync("/proc/net/dev").split("\n");
    } catch (e) {
      console.error(`Can not fetch internet speed from /proc/net/dev: ${e}`);
      return null;
    }
    let bytesByInterface = new Map();
    for (let line of lines) {
      let separatorIndex = line.indexOf(":");
      if (separatorIndex < 0) {
        // The two header lines and the trailing empty line have no colon.
        continue;
      }
      let interfaceName = line.slice(0, separatorIndex).trim();
      if (!this.isPhysicalInterface(interfaceName)) {
        continue;
      }
      let counters = line.slice(separatorIndex + 1).trim().split(/\s+/);
      let downloadBytes = parseInt(counters[0]);
      let uploadBytes = parseInt(counters[8]);
      if (!isNaN(downloadBytes) && !isNaN(uploadBytes)) {
        bytesByInterface.set(interfaceName, downloadBytes + uploadBytes);
      }
    }
    return bytesByInterface;
  }

  // Sum the byte change of each interface since the previous sample. An
  // interface that appeared since then adds nothing, and one that went away
  // is not in the current sample. So an interface that connects or
  // disconnects (for example, USB tethering) can not make the total jump or
  // go negative. A counter that went down (for example, after a driver reset)
  // also adds nothing.
  getTransferredBytes(currentBytesByInterface) {
    let transferredBytes = 0;
    for (let [interfaceName, currentBytes] of currentBytesByInterface) {
      let previousBytes = this.previousBytesByInterface.get(interfaceName);
      if (previousBytes !== undefined && currentBytes >= previousBytes) {
        transferredBytes += currentBytes - previousBytes;
      }
    }
    return transferredBytes;
  }

  // Update current net speed (upload + download) to shell
  updateNetSpeed() {
    let currentBytesByInterface = this.getBytesByInterface();
    if (currentBytesByInterface == null) {
      this.netSpeedLabel.set_text(InternetSpeedMeter.defaultNetSpeedText);
      // Start again from an empty sample. Otherwise the first successful read
      // would show the bytes of several intervals as the speed of one.
      this.previousBytesByInterface = new Map();
    } else {
      let speed = this.getTransferredBytes(currentBytesByInterface) / InternetSpeedMeter.unitBase;
      this.netSpeedLabel.set_text("⇅ " + this.getFormattedSpeed(speed));
      this.previousBytesByInterface = currentBytesByInterface;
    }
    // Keep the timer running after a failed read, so the meter recovers on
    // the next tick. disable() is the only place that stops the timer.
    return GLib.SOURCE_CONTINUE;
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

    this.previousBytesByInterface = this.getBytesByInterface() ?? new Map();

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
    this.previousBytesByInterface = new Map();
  }
}
