# AVD applet

Gnome Shell AVD applet provide menu to run Android Virtual device without launching Android Studio.

Device list populated after 5 seconds after extension is activated, to not slow down screen unlock.
(Gnome Shell deactivates all extensions on screen lock and activates on unlock).

It's expected to have Android Sdk Tools installed in default location : `~/Android/Sdk`.

So far it's not able to create device or run AVD Manager.

 

![screenshot](screenshot.png?raw=true)

Installation
------------

Go to [AVD applet](https://extensions.gnome.org/extension/1777/avd-applet/) to download/enable it


Development
-----------

Restart extension: `Alt`+`F2` -> `r`

Extension logs can be seen in one of the following ways:
- `Alt`+`F2` -> `lg`
- `journalctl -f | grep 'avd-applet'`
