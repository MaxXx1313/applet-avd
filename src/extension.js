/* global imports */

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const TEXT_APPNAME = 'AVD applet';
const TEXT_LOGID   = 'avd-applet';
const ICON_SIZE    = 22;
const DEBUG        = true;


let applet;
let enabled = false;

class AVDApplet extends PanelMenu.Button {

    constructor() {
        super( 0.0, TEXT_APPNAME );
        
        this._log('Create applet');

        // set ANDROID_HOME env
        this.homeDir = GLib.getenv('HOME');
        this.androidHome = this.homeDir + '/Android/Sdk';
        GLib.setenv('ANDROID_HOME', this.androidHome, true);
        this._log('ANDROID_HOME: ', this.androidHome);

        // set PATH
        var PATH = GLib.getenv('PATH');
        PATH += ':' + this.androidHome + '/emulator';
        PATH += ':' + this.androidHome + '/tools';
        PATH += ':' + this.androidHome + '/tools/bin';
        PATH += ':' + this.androidHome + '/platform-tools';
        // PATH += ':' + '/opt/jdk1.8.0_201/bin/java';
        GLib.setenv('PATH', PATH, true);
        this._log('PATH: ', PATH);
        

        // GLib.setenv('JAVA_HOME', '/opt/jdk1.8.0_201', true);
        this._log('JAVA_HOME: ', GLib.getenv('JAVA_HOME'));

        //
        this._populated = false;
        this._menuitems = [];
        let hbox = new St.BoxLayout( { style_class: 'panel-status-menu-box' } );
        let gicon = Gio.icon_new_for_string( Me.path + '/icons/avd.svg' );
        hbox.add_child( new St.Icon( { gicon: gicon, icon_size: ICON_SIZE } ) );
        this.actor.add_child(hbox);
        this.menu.actor.connect('notify::visible', this._onVisibilityChanged.bind(this));

        this._tmpItem = new PopupMenu.PopupMenuItem( '...' );
        this.menu.addMenuItem( this._tmpItem );

        Mainloop.timeout_add_seconds( 5, this.populateMenu.bind(this) );
    }

    startVbox() {
        GLib.spawn_command_line_async( 'virtualbox' );
    }

    startVM( name, id ) {
        if ( this._isVMRunning( id ) ) {
            this._activateWindow( name );
        }
        else {
            GLib.spawn_command_line_async( 'vboxmanage startvm ' + id );
        }
    }

    /**
     * Output example:
     ```text
        user@mypc:~$ avdmanager list avd
        Parsing /home/user/Android/Sdk/build-tools/23.0.1/package.xmlParsing /home/user/Android/Sdk/build-tools/27.0.3/package.xmlParsing /home/user/Android/Sdk/build-tools/28.0.0/package.xmlParsing /home/user/Android/Sdk/build-tools/28.0.3/package.xmlParsing /home/user/Android/Sdk/emulator/package.xmlParsing /home/user/Android/Sdk/extras/android/m2repository/package.xmlParsing /home/user/Android/Sdk/extras/google/m2repository/package.xmlParsing /home/user/Android/Sdk/extras/m2repository/com/android/support/constraint/constraint-layout-solver/1.0.2/package.xmlParsing /home/user/Android/Sdk/extras/m2repository/com/android/support/constraint/constraint-layout/1.0.2/package.xmlParsing /home/user/Android/Sdk/patcher/v4/package.xmlParsing /home/user/Android/Sdk/platform-tools/package.xmlParsing /home/user/Android/Sdk/platforms/android-23/package.xmlParsing /home/user/Android/Sdk/platforms/android-24/package.xmlParsing /home/user/Android/Sdk/platforms/android-26/package.xmlParsing /home/user/Android/Sdk/platforms/android-27/package.xmlParsing /home/user/Android/Sdk/platforms/android-28/package.xmlParsing /home/user/Android/Sdk/sources/android-28/package.xmlParsing /home/user/Android/Sdk/system-images/android-24/android-tv/x86/package.xmlParsing /home/user/Android/Sdk/system-images/android-26/google_apis/x86/package.xmlParsing /home/user/Android/Sdk/tools/package.xmlAvailable 
         Android Virtual Devices:
            Name: Android_TV_1080p_API_24
          Device: tv_1080p (Google)
            Path: /home/user/.android/avd/Android_TV_1080p_API_24.avd
          Target: Android TV
                  Based on: Android 7.0 (Nougat) Tag/ABI: android-tv/x86
            Skin: tv_1080p
          Sdcard: 512M
        ---------
            Name: Nexus_7_2012_API_26
          Device: Nexus 7 (Google)
            Path: /home/user/.android/avd/Nexus_7_2012_API_26.avd
          Target: Google APIs (Google Inc.)
                  Based on: Android 8.0 (Oreo) Tag/ABI: google_apis/x86
            Skin: nexus_7
          Sdcard: 512M
      ```
     */
    parseVMList( vms ) {
        this._log( 'parseVMList: ' + vms);
        let res = [];
        if ( vms.length !== 0 ) {
            let data = vms.toString().split('Android Virtual Devices:')[1];
            let lines = data.split('\n');

            var deviceInfo = {};
            var _prevKey = '_';
            for ( let i = 0; i < lines.length; i++ ) {
                let line = lines[i];
                if ( line === '' ) {
                    continue;
                }

                if(line.startsWith('---')){
                    // device separator
                    this._log( 'Machine name: ' + deviceInfo.name + ', ID: ' + deviceInfo.path );
                    res.push(deviceInfo);

                    //
                    deviceInfo = {};
                    _prevKey= '_';
                    continue;
                }

                var m = line.match(/^\s*(.*?)\s*:\s*(.*?)\s*$/);
                if(m) {
                    _prevKey = m[1].toLowerCase();
                   deviceInfo[_prevKey] = m[2]; 
                } else {
                   deviceInfo[_prevKey] += ' ' + line; 
                }

            }
            if( Object.keys(deviceInfo).length > 0){
                this._log( 'Machine name: ' + deviceInfo.name + ', ID: ' + deviceInfo.path );
                res.push(deviceInfo);                
            }
        }
        return res;
    }

    populateMenu() {
        let vms;
        try {
            this._log( 'Run \'avdmanager list avd\'' );
            // GLib.spawn_sync( null, ['avdmanager'], null, GLib.SpawnFlags.SEARCH_PATH, null, null);
            vms = GLib.spawn_command_line_sync( 'avdmanager list avd' );
            // vms = String(GLib.spawn_sync( null, ['avdmanager', 'list', 'avd'], {PATH: this.androidHome +'/tools/bin'}, GLib.SpawnFlags.SEARCH_PATH, null, null));
            if(vms[2]){      
                this._log( vms );   
            }   
        }
        catch (err) {
            this._log( err );
            Main.notifyError( TEXT_APPNAME + ': ' + err );
            return;
        }


        let machines = this.parseVMList( vms[1] );

        if ( machines.length !== 0 ) {
            this._tmpItem.destroy();

            for ( let i = 0; i < machines.length; i++ ) {
                let name = machines[i].name;
                let id = machines[i].path;

                let menuitem = new PopupMenu.PopupMenuItem( name );
                menuitem._vmid = id;
                menuitem.connect( 'activate', this.startVM.bind(this, name, id) );
                this.menu.addMenuItem(menuitem);
                this._menuitems.push(menuitem);
            }
        }

        // separator
        this.menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

        // run manager
        let menuitem = new PopupMenu.PopupMenuItem( 'VirtualBox...' );
    	menuitem.connect( 'activate', this.startVbox.bind(this) );
        this.menu.addMenuItem( menuitem );

        this._populated = true;

        return false;
    }

    _log( text ) {
        if ( DEBUG ) {
            global.log( TEXT_LOGID, [...arguments] );
        }
    }

    _isVMRunning( id ) {
        let machines = this._getRunningVMs();
        return this.searchInVMs( machines, id );
    }

    _getRunningVMs() {
        let vms;
        try {
            this._log( 'Run \'vboxmanage list runningvms\'' );
            vms = String( GLib.spawn_command_line_sync( 'avdmanager list avd' )[1] );
        }
        catch (err) {
            this._log( err );
            return;
        }

        return this.parseVMList( vms );
    }

    _onVisibilityChanged() {
        if ( this.menu.actor.visible && this._populated ) {
            Mainloop.timeout_add( 200, this._markRunning.bind(this) );
        }
    }

    _markRunning() {
        let machines = this._getRunningVMs();

        for (var i = 0; i < this._menuitems.length; i++) {
            let running = this.searchInVMs( machines, this._menuitems[i]._vmid );
            this._menuitems[i].setOrnament( running ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE );
        }
    }

    searchInVMs( machines, id ) {
        for ( var i = 0; i < machines.length; i++ ) {
            if ( machines[i].id === id ) {
                return true;
            }
        }
        return false;
    }

    _activateWindow( name ) {
        let a = global.get_window_actors();
        for (var i = 0; i < a.length; i++)
        {
            let mw = a[i].metaWindow;
            let title = mw.get_title();

            if ( title.startsWith( name ) && title.toLowerCase().includes('virtualbox') ) {
                this._log( 'activate window: ' + title );
                mw.activate( global.get_current_time() );
            }
        }
    }
};


function enable() {
    enabled = true;
    applet = new AVDApplet();
    Main.panel.addToStatusArea( TEXT_APPNAME, applet );
}

function disable() {
    enabled = false;
    applet.destroy();
}
