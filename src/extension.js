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
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export default class InternetSpeedMeter extends Extension {

  static refreshTimeInSeconds = 1;
  static unitBase = 1024.0; // 1 GB == 1024MB or 1MB == 1024KB etc.
  static units = ["KB/s", "MB/s", "GB/s", "TB/s", "PB/s", "EB/s"];
  static defaultNetSpeedText = "⇅ -.-- --";

  static microsecondsPerSecond = 1000000.0;

  previousBytesByInterface = new Map();
  previousSampleTime = 0; // GLib.get_monotonic_time() of previousBytesByInterface
  indicator = null;
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
    let currentSampleTime = GLib.get_monotonic_time();
    if (currentBytesByInterface == null) {
      this.netSpeedLabel.set_text(InternetSpeedMeter.defaultNetSpeedText);
      // Start again from an empty sample. Otherwise the first successful read
      // would show the bytes of several intervals as the speed of one.
      this.previousBytesByInterface = new Map();
    } else {
      // GLib.timeout_add_seconds() does not fire at exact one second
      // intervals, and a busy main loop delays it more. So divide by the
      // measured time between the two samples, not by the refresh time.
      let elapsedSeconds =
        (currentSampleTime - this.previousSampleTime) / InternetSpeedMeter.microsecondsPerSecond;
      if (elapsedSeconds > 0) {
        let bytesPerSecond = this.getTransferredBytes(currentBytesByInterface) / elapsedSeconds;
        let speed = bytesPerSecond / InternetSpeedMeter.unitBase;
        this.netSpeedLabel.set_text("⇅ " + this.getFormattedSpeed(speed));
      }
      this.previousBytesByInterface = currentBytesByInterface;
    }
    this.previousSampleTime = currentSampleTime;
    // Keep the timer running after a failed read, so the meter recovers on
    // the next tick. disable() is the only place that stops the timer.
    return GLib.SOURCE_CONTINUE;
  }

  // Format a speed in KB/s to a readable string. Go to the next unit when the
  // value would print as 1000.00 or more (for example 1000 to 1023.99 KB/s),
  // even though the units are 1024 apart. Four integer digits make the label
  // wider than its min-width in stylesheet.css, and the panel icons move.
  getFormattedSpeed(speed) {
    let i = 0;
    let lastUnitIndex = InternetSpeedMeter.units.length - 1;
    while (i < lastUnitIndex && parseFloat(speed.toFixed(2)) >= 1000.0) {
      // Convert speed to KB, MB, GB or TB
      speed /= InternetSpeedMeter.unitBase;
      ++i;
    }
    return speed.toFixed(2) + " " + InternetSpeedMeter.units[i];
  }

  enable() {
    // A panel button without a menu. It only shows the label, so turn off
    // hover, focus and clicks.
    this.indicator = new PanelMenu.Button(0.0, this.metadata.name, true);
    this.indicator.setSensitive(false);
    this.netSpeedLabel = new St.Label({
      text: InternetSpeedMeter.defaultNetSpeedText,
      style_class: "netSpeedLabel",
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.indicator.add_child(this.netSpeedLabel);
    // Position 0 of the right box: left of the system status icons.
    Main.panel.addToStatusArea(this.uuid, this.indicator, 0, "right");

    this.previousBytesByInterface = this.getBytesByInterface() ?? new Map();
    this.previousSampleTime = GLib.get_monotonic_time();

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
    if (this.indicator != null) {
      // Destroying the button also removes it from the panel and from
      // Main.panel.statusArea.
      this.indicator.destroy();
      this.indicator = null;
    }
    this.netSpeedLabel = null;
    this.previousBytesByInterface = new Map();
    this.previousSampleTime = 0;
  }
}
