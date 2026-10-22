#!/bin/sh
set -eu
# Run as root on the existing Ubuntu VM, from an extracted course source release.
test "$(id -u)" = 0
app_dir=$(pwd)
case "$app_dir" in /opt/group9-live/releases/*) ;; *) echo 'Use /opt/group9-live/releases/<commit>/course'; exit 1 ;; esac
case "$(uname -m)" in aarch64) node_arch=arm64; media_arch=arm64 ;; x86_64) node_arch=x64; media_arch=amd64 ;; *) exit 1 ;; esac
base=/opt/group9-live
if [ ! -f "$base/DEPLOYMENT" ] && { systemctl cat group9-web >/dev/null 2>&1 || systemctl cat group9-media >/dev/null 2>&1; }; then
  echo 'Existing service names are not managed by this installer'; exit 1
fi
for port in 4180 1935 8888 9997; do
  if [ ! -f "$base/DEPLOYMENT" ] && ss -ltnH "sport = :$port" | grep -q .; then echo "Port $port is already in use"; exit 1; fi
done
if ! command -v curl >/dev/null || ! command -v xz >/dev/null; then apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates xz-utils; fi
mkdir -p "$base/runtime" "$base/shared"
chmod 700 "$base/shared"
cd "$base/runtime"
node_version=24.18.0
node_archive="node-v$node_version-linux-$node_arch.tar.xz"
if [ ! -x "node-v$node_version-linux-$node_arch/bin/node" ]; then
  curl -fLsS --retry 2 "https://nodejs.org/dist/v$node_version/$node_archive" -o "$node_archive"
  curl -fLsS --retry 2 "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" -o node-checksums.txt
  grep -F "$node_archive" node-checksums.txt | sha256sum -c -
  tar -xf "$node_archive"
fi
media_archive="mediamtx_v1.21.2_linux_$media_arch.tar.gz"
if [ ! -x mediamtx/mediamtx ]; then
  curl -fLsS --retry 2 "https://github.com/bluenviron/mediamtx/releases/download/v1.21.2/$media_archive" -o "$media_archive"
  curl -fLsS --retry 2 https://github.com/bluenviron/mediamtx/releases/download/v1.21.2/checksums.sha256 -o media-checksums.txt
  grep -F "$media_archive" media-checksums.txt | sha256sum -c -
  mkdir -p mediamtx
  tar -xzf "$media_archive" -C mediamtx
fi
export PATH="$base/runtime/node-v$node_version-linux-$node_arch/bin:$PATH"
cd "$app_dir"
if [ ! -e .runtime ]; then ln -s "$base/shared" .runtime; fi
node scripts/configure.mjs --duo
"$base/runtime/mediamtx/mediamtx" --validate-conf=.runtime/mediamtx.duo.yml
npm ci --no-audit --no-fund
npm test
npm run build
id group9-live >/dev/null 2>&1 || useradd --system --home "$base" --shell /usr/sbin/nologin group9-live
chown -R group9-live:group9-live "$base/shared"
cat > /etc/systemd/system/group9-media.service <<EOF
[Unit]
Description=Group 9 MediaMTX
After=network.target
[Service]
User=group9-live
WorkingDirectory=$app_dir
ExecStart=$base/runtime/mediamtx/mediamtx $base/shared/mediamtx.duo.yml
Restart=on-failure
NoNewPrivileges=true
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/group9-web.service <<EOF
[Unit]
Description=Group 9 React HLS and Socket.IO
After=network.target group9-media.service
[Service]
User=group9-live
WorkingDirectory=$app_dir
Environment=HOST=127.0.0.1
Environment=PORT=4180
Environment=DB_PATH=$base/shared/live.sqlite
EnvironmentFile=-$base/shared/app.env
ExecStart=$base/runtime/node-v$node_version-linux-$node_arch/bin/node $app_dir/server.mjs
Restart=on-failure
NoNewPrivileges=true
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable group9-media group9-web
systemctl restart group9-media group9-web
printf '%s\n' "$app_dir" > "$base/DEPLOYMENT"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4180/api/status; then echo; break; fi
  sleep 1
done
systemctl is-active group9-media group9-web
echo 'GROUP9_DEPLOYED. Ports are bound to loopback; use SSH tunnel.'
