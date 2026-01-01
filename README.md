# Stupid Network Chart

An Electron app that renders a chart of network speed in the macOS menu bar.

## How It Works

It runs `netstat -i -b -w 1` to get network statistics every second.

Then it uses Electron's [`Tray`](https://www.electronjs.org/docs/latest/api/tray) API to draw a stupid chart.

curl "https://speed.cloudflare.com/__down?bytes=10000000" > test.txt