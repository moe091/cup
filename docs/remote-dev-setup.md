---
description: Quick reference commands for remote dev over LAN SSH.
---

## Desktop (Windows 10 host) — quick health check

Run in **Admin PowerShell**:

```powershell
Get-Service sshd
netstat -ano | findstr :2222
```

If needed, start/restart sshd:

```powershell
Start-Service sshd
# or
Restart-Service sshd
```

Optional connectivity check from desktop itself:

```powershell
Test-NetConnection 127.0.0.1 -Port 2222
```

---

## Laptop (Windows 11) — connect to desktop

```powershell
ssh -p 2222 mnowi@192.168.1.147
```

After SSH login, enter WSL on the desktop host:

```powershell
wsl -d Ubuntu-24.04
```

---

## Laptop — connect with local port forwarding

Example for web dev server on port `5173`:

```powershell
ssh -p 2222 -L 5173:127.0.0.1:5173 mnowi@192.168.1.147
```

Then open on laptop:

```text
http://localhost:5173
```

---

## Common alternate tunnel commands

Frontend port 3000:

```powershell
ssh -p 2222 -L 3000:127.0.0.1:3000 mnowi@192.168.1.147
```

API port 3001:

```powershell
ssh -p 2222 -L 3001:127.0.0.1:3001 mnowi@192.168.1.147
```

Multiple forwards in one SSH session:

```powershell
ssh -p 2222 -L 5173:127.0.0.1:5173 -L 3001:127.0.0.1:3001 mnowi@192.168.1.147
```

---

## Laptop — quick network checks if connection fails

```powershell
ping 192.168.1.147
Test-NetConnection 192.168.1.147 -Port 2222
```

---

## Optional: SSH alias on laptop (`~/.ssh/config`)

Create/edit this file on the laptop:

```powershell
notepad $HOME\.ssh\config
```

Add:

```sshconfig
Host cup-desktop
  HostName 192.168.1.147
  User mnowi
  Port 2222
  IdentitiesOnly yes
  IdentityFile ~/.ssh/id_ed25519

Host cup-desktop-tunnel
  HostName 192.168.1.147
  User mnowi
  Port 2222
  IdentitiesOnly yes
  IdentityFile ~/.ssh/id_ed25519
  LocalForward 5173 127.0.0.1:5173
  LocalForward 3001 127.0.0.1:3001

Host cup-wsl
  HostName 192.168.1.147
  User moe
  Port 2223
  IdentitiesOnly yes
  IdentityFile ~/.ssh/id_ed25519

Host cup-wsl-tunnel
  HostName 192.168.1.147
  User moe
  Port 2223
  IdentitiesOnly yes
  IdentityFile ~/.ssh/id_ed25519
  LocalForward 5173 127.0.0.1:5173
  LocalForward 3001 127.0.0.1:3001
```

Then connect with:

```powershell
ssh cup-desktop
```

Port forwarding with alias:

```powershell
ssh cup-desktop -L 5173:127.0.0.1:5173
```

Preconfigured tunnel alias (one command):

```powershell
ssh cup-desktop-tunnel
```

Connect directly to WSL:

```powershell
ssh cup-wsl
```

Direct WSL tunnel alias:

```powershell
ssh cup-wsl-tunnel
```

---

## VS Code (laptop) — connect directly to desktop WSL

1) Install extension: **Remote - SSH**

2) Connect:

- `Ctrl+Shift+P` -> `Remote-SSH: Connect to Host...`
- choose `cup-wsl`
- when prompted for host platform, choose `Linux`

3) Open project folder in the remote window:

```text
/home/moe/dev/cup
```

4) Use terminal in that window normally (this terminal is your desktop WSL shell):

```bash
cd /home/moe/dev/cup
pnpm run dev
```

5) To open app in laptop browser, keep a tunnel session open (separate laptop terminal):

```powershell
ssh cup-wsl-tunnel
```

Then open:

```text
http://localhost:5173
```

---

## If WSL IP changes (fix `cup-wsl` / port 2223)

Run on desktop host.

1) Get current WSL IP:

```powershell
wsl -d Ubuntu-24.04 hostname -I
```

2) Recreate Windows portproxy to new WSL IP (Admin PowerShell):

```powershell
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=2223
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=2223 connectaddress=<NEW_WSL_IP> connectport=22
```

3) Verify locally on desktop:

```powershell
netsh interface portproxy show all
Test-NetConnection 127.0.0.1 -Port 2223
```

4) Verify from laptop:

```powershell
Test-NetConnection 192.168.1.147 -Port 2223
ssh cup-wsl
```

If it still fails, ensure WSL sshd is running:

```bash
sudo service ssh start
sudo service ssh status
```

---

## 30-second startup checklist

1) Open tunnel on laptop:

```powershell
ssh cup-wsl-tunnel
```

2) Open VS Code -> `Remote-SSH: Connect to Host...` -> `cup-wsl`

3) In VS Code terminal:

```bash
cd /home/moe/dev/cup
pnpm run dev
```

4) Open laptop browser:

```text
http://localhost:5173
```

---

## Reboot/reconnect recovery checklist

If `cup-wsl` or `cup-wsl-tunnel` fails after reboot:

1) On desktop (WSL), ensure sshd is running:

```bash
sudo service ssh start
sudo service ssh status
```

2) On desktop (Windows PowerShell Admin), get current WSL IP:

```powershell
wsl -d Ubuntu-24.04 hostname -I
```

3) Update portproxy `2223` with that IP:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=2223
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=2223 connectaddress=<NEW_WSL_IP> connectport=22
```

4) Verify:

```powershell
Test-NetConnection 127.0.0.1 -Port 2223
Test-NetConnection 192.168.1.147 -Port 2223
```
