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
