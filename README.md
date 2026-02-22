# MingInfo - Linux Stream Deck Dashboard (OpenDeck Optimized)

**MingInfo** is a high-performance system monitoring plugin built specifically for Linux. It is **fully optimized for OpenDeck** (and StreamController) to provide a seamless, native experience with full support for Stream Deck + dials.

![MingInfo Dashboard](assets/screenshot.png)

## ✨ Why MingInfo?
* **OpenDeck Native:** Seamless integration and dead-simple ZIP import.
* **Smart Storage:** Intelligent disk aggregation that filters out BTRFS subvolumes, Docker mounts, and Snap clutter.
* **AMD Specialist:** Dedicated support for AMD GPU usage, VRAM, and power draw.
* **High-Precision Ping:** Accurate sub-1ms latency detection (no "0ms" glitch on high-speed fiber).
* **Full Encoder Support:** High-resolution Dials for Volume (WirePlumber), Monitor Brightness (DDC/CI), and Countdown Timers.
* **Top Process Tracker:** Instantly identifies which application is hogging your CPU.

## 📥 Installation via OpenDeck (Recommended)

1.  Download the latest `minginfo-v1.1.zip` from the [Releases page](https://github.com/kahikara/minginfo/releases).
2.  Open your **OpenDeck** dashboard.
3.  Click on **"Import Plugin"** and select the ZIP file.
4.  That's it! The actions will appear in your sidebar immediately.

## 🛠️ Requirements & Setup

To ensure all features work correctly, make sure these tools are installed:
* **Audio:** `wireplumber` (for volume dials)
* **Monitor:** `ddcutil` (for brightness dials)
* **Sensors:** `lm-sensors` (for temperatures)

### 💡 Pro Tip: AMD Ryzen Power Monitoring (zenergy)
By default, the Linux kernel restricts access to CPU power registers. If your CPU shows **0W**, you need the `zenergy` driver:

**Arch Linux:** `yay -S zenergy-dkms-git`
**Others:** Follow instructions at [BoukeHaarsma23/zenergy](https://github.com/BoukeHaarsma23/zenergy).

### Permissions for Brightness Control
To allow OpenDeck to control your monitor's hardware brightness via DDC/CI:
```bash
sudo usermod -aG i2c $USER
