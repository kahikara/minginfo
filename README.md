# Redline Monitor

Compact Linux monitoring and control plugin for OpenDeck.

![Redline Monitor Dashboard](assets/screenshot.png)

## Actions

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
* Battery

## Highlights

* AMD, Intel, and NVIDIA support
* Multi GPU selector for GPU and VRAM
* Stable battery device selector
* sysfs first battery handling for better Linux reliability
* Key and encoder actions
* Optional custom on press command
* Compact monitoring cards with action specific settings

## What each action shows

* **CPU** shows load, temperature, and CPU power. The bar represents temperature with a 100°C cap.
* **GPU** shows usage, power, and temperature. The bar represents temperature with a 100°C cap.
* **VRAM** shows used and total VRAM for the selected GPU.
* **RAM** shows used and total system memory.
* **Network** shows download and upload throughput.
* **Disk** shows combined usage and free space.
* **Ping** shows latency to a custom host. The bar is capped at 100 ms.
* **Top Proc** shows the top CPU consumer.
* **Time and Date** works on keys and encoders.
* **Audio Volume** supports key and encoder control.
* **Alarm Timer** is encoder based.
* **Monitor Brightness** is encoder based through DDC or CI.
* **Battery** shows the selected battery device, percentage, and charging state.

## Settings

Only relevant settings are shown for the selected action.

Available settings include:

* Ping host
* Network interface override
* GPU selector
* Battery device selector
* Volume step
* Brightness step
* Timer step
* Top mode
* Refresh rate
* On press action
* Custom command

## Requirements

Depending on the action, you may need:

* `wireplumber`
* `ddcutil`
* `lm-sensors`
* `zenergy`
* `nvidia-smi`
* `pciutils`

If Ryzen CPU power reads as `0W`, install `zenergy`.

Arch Linux:

```sh
yay -S zenergy-dkms-git
```

For monitor brightness through DDC or CI, add your user to the `i2c` group:

```sh
sudo usermod -aG i2c $USER
```

## Notes

Battery handling prefers sysfs when available and falls back to UPower when needed. This improves reliability for wireless Linux devices that expose unstable or duplicated battery nodes.

Custom press commands are useful for launching tools, restarting services, or triggering recovery actions directly from the same key.
