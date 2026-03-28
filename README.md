# Redline Monitor

Redline Monitor is a Linux focused monitoring plugin for **OpenDeck** with a strong focus on AMD systems.

![Redline Monitor Dashboard](assets/screenshot.png)

## Features

Redline Monitor includes actions for:

* CPU
* GPU
* VRAM
* RAM
* Network
* Disk
* Ping
* Top Proc
* Time and Date
* Audio Volume
* Alarm Timer
* Monitor Brightness

## Action details

* **CPU** shows load, temperature, and CPU power. Key press opens Plasma System Monitor.
* **GPU** shows usage, power, and temperature. Key press opens LACT.
* **VRAM** shows used and total GPU memory.
* **RAM** shows active memory usage.
* **Network** shows download and upload throughput.
* **Disk** shows combined disk usage and free space.
* **Ping** shows latency to a custom host. Key press forces an immediate refresh.
* **Top Proc** shows the current top CPU consumer.
* **Time and Date** shows local time and date.
* **Audio Volume** is available as key and encoder action.
* **Alarm Timer** is available as encoder action.
* **Monitor Brightness** is available as encoder action through DDC/CI.

## Settings

The property inspector supports these settings:

* **Ping host** for the Ping action
* **Network interface override** for the Network action
* **Volume step** for Audio Volume
* **Brightness step** for Monitor Brightness
* **Timer step in minutes** for Alarm Timer
* **Top process mode** with grouped or raw process view
* **Refresh rate** as plugin wide polling interval

## Requirements

Depending on the action you use, these tools may be needed:

* `wireplumber` for audio volume control
* `ddcutil` for monitor brightness control
* `lm-sensors` for temperature readings
* `zenergy` for AMD Ryzen package power readings

If CPU power reads as `0W` on Ryzen, install `zenergy`.
Arch Linux command: `yay -S zenergy-dkms-git`

For monitor brightness control through DDC/CI, add your user to the `i2c` group.
Command: `sudo usermod -aG i2c $USER`

## Installation

1. Download the latest release ZIP from the Releases page
2. Open **OpenDeck**
3. Choose **Import Plugin**
4. Select the ZIP file

## Project page

https://github.com/kahikara/opendeck-redline-monitor
