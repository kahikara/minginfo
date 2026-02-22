![MingInfo Dashboard](assets/screenshot.png)

# MingInfo - Linux Stream Deck Dashboard (OpenDeck Optimized)

**MingInfo** is a high-performance system monitoring plugin built specifically for Linux. While it works with the official client, it is **fully optimized for OpenDeck** to provide a seamless, native experience.

![MingInfo Dashboard](assets/screenshot.png)

## ✨ Why MingInfo?
* **OpenDeck Native:** Smooth integration and easy import.
* **Smart Monitoring:** CPU (Watts/Temp), AMD GPU (Usage/VRAM), RAM, and intelligent Disk aggregation (BTRFS-aware).
* **High-Precision Ping:** Accurate sub-1ms latency detection (perfect for fiber connections).
* **Full Encoder Support:** High-resolution Dials for Volume (WirePlumber), Monitor Brightness (DDC/CI), and Timers.

## 📥 Installation via OpenDeck (Recommended)

1. Download the latest `minginfo-v1.1.zip` from the [Releases](https://github.com/kahikara/minginfo/releases) page.
2. Open your **OpenDeck** dashboard.
3. Click the **"Import Plugin"** button (or the `+` icon in the plugin manager).
4. Select the downloaded ZIP file.
5. All set! The actions will appear in your sidebar immediately.

## 🛠️ Requirements & Setup

To use the advanced features, ensure these tools are on your system:
* **Audio:** `wireplumber` (for volume dials)
* **Monitor:** `ddcutil` (for brightness dials)
* **Sensors:** `lm-sensors` (for temps)

### Permission for Brightness Dials
For OpenDeck to control your monitor's hardware brightness:
```bash
sudo usermod -aG i2c $USER
