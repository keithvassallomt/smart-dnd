# Choosing specific calendars

Smart DND works out of the box. However, to choose **which calendars** a
calendar rule watches, it needs one extra system package: the Evolution Data
Server introspection data. Some Linux distributions don't install it by default.

If the Calendar page in Smart DND's settings says this package is missing,
follow the steps below. It takes about a minute.

## Step 1: Find out which distribution you have

Open **Settings**, go to **System**, then **About**. Your distribution is shown
next to **OS Name** (for example, *Ubuntu 26.04 LTS*).

## Step 2: Open a terminal

Press the **Super** key (the Windows key), type **Terminal**, and press
**Enter**.

## Step 3: Run the command for your distribution

Find your distribution below and copy its command. Paste it into the terminal
with **Ctrl + Shift + V**, then press **Enter**.

- When asked for your password, type it and press **Enter**. Nothing appears on
  screen while you type; that's normal.
- If you're asked to confirm, type **y** and press **Enter**.

### Ubuntu

```bash
sudo apt install gir1.2-edataserver-1.2
```

This also works on distributions based on Ubuntu.

### Debian

```bash
sudo apt install gir1.2-edataserver-1.2
```

This also works on distributions based on Debian, such as Kali.

### CachyOS

```bash
sudo pacman -S evolution-data-server
```

CachyOS's GNOME install leaves out the service GNOME uses to read your
calendars, so this installs that too. Without it, calendar rules can't see any
events at all. Log out and back in once it finishes.

### openSUSE Tumbleweed

```bash
sudo zypper install typelib-1_0-EDataServer-1_2
```

### EndeavourOS

```bash
sudo pacman -S evolution-data-server
```

EndeavourOS's GNOME install leaves out the service GNOME uses to read your
calendars, so this installs that too. Without it, calendar rules can't see any
events at all. Log out and back in once it finishes.

## Step 4: Reopen Smart DND's settings

1. Close the Smart DND settings window.
2. If the **Extensions** or **Extension Manager** app is open, close that too.
3. Open Smart DND's settings again.

Expand a calendar rule and you'll now see a **Calendars** row where you can pick
which calendars it watches. If you don't, log out and back in, then check again.

## You may already have it

These distributions include the package with GNOME, so you shouldn't need to do
anything:

- Fedora Workstation (including Silverblue, Bazzite and Bluefin)
- Arch Linux, when GNOME is installed with the `gnome` group
- Manjaro GNOME
- RHEL, AlmaLinux and CentOS Stream 10

## Still stuck?

- **No calendars in the list?** Smart DND shows the calendars GNOME knows about.
  Add your accounts in **Settings → Online Accounts**.
- **Different distribution?** Search your package manager for a package with
  *EDataServer* and *typelib* (or *gir*) in its name.
- **Something else?** [Open an issue](https://github.com/keithvassallomt/smart-dnd/issues)
  and include your distribution and version.
