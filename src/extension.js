/* global imports */

const { GLib, Gio, GObject, St, Shell } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const ByteArray = imports.byteArray;

const TEXT_APPNAME = 'AVD applet';
const TEXT_LOGID   = 'avd-applet';
const ICON_SIZE    = 22;
const DEBUG        = true;

global.log(TEXT_LOGID, 'AVDApplet');

let applet;
let enabled = false;

// trying to construct an object without GType

let AVDApplet = GObject.registerClass(
class AVDApplet extends PanelMenu.Button {

    _init() {
        this._log('Create applet');
        super._init( 0.0, TEXT_APPNAME );

        // set ANDROID_HOME env
        this.homeDir = GLib.getenv('HOME');
        this.androidHome = this.homeDir + '/Android/Sdk';
        GLib.setenv('ANDROID_HOME', this.androidHome, true);
        this._log('ANDROID_HOME: ', this.androidHome);

        // set PATH
        var PATH = GLib.getenv('PATH');
        if(PATH.indexOf(this.androidHome + '/emulator') < 0) { // TODO: technically, the condition is not absolutely correct 
            PATH += ':' + this.androidHome + '/emulator';
        }
        // PATH += ':' + this.androidHome + '/tools';
        // PATH += ':' + this.androidHome + '/tools/bin';
        // PATH += ':' + this.androidHome + '/platform-tools';
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

        // set 'loading' stste
        this._tmpItem = new PopupMenu.PopupMenuItem( '...' );
        this.menu.addMenuItem( this._tmpItem );

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, this.populateMenu.bind(this) );
    }

    // startVbox() {
    //     GLib.spawn_command_line_async( 'virtualbox' );
    // }

    startVM( name, id ) {
        this._log('startVM: ', id, name);

        // if ( this._isVMRunning( id ) ) {
        //     this._activateWindow( name );
        // }
        // else {
            // GLib.spawn_command_line_async( 'vboxmanage startvm ' + id );
            GLib.spawn_command_line_async( 'emulator -avd ' + id );
        // }
    }

    populateMenu() {
        let machines = this._getVMs()

        if ( machines.length !== 0 ) {
            this._tmpItem.destroy();

            for ( let i = 0; i < machines.length; i++ ) {
                let name = machines[i].name;
                let id = machines[i].id;

                // create menu item
                let menuitem = new PopupMenu.PopupMenuItem( name );
                menuitem._vmid = id;
                menuitem.connect( 'activate', this.startVM.bind(this, name, id) );
                this.menu.addMenuItem(menuitem);
                this._menuitems.push(menuitem);
            }
        } else {
            let menuitem = new PopupMenu.PopupMenuItem( 'No devices' );
            this.menu.addMenuItem( menuitem );
        }

        // separator
        // this.menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

        // run manager
        //    let menuitem = new PopupMenu.PopupMenuItem( 'Device Manager...' );
        // menuitem.connect( 'activate', this.startVbox.bind(this) );
        //    this.menu.addMenuItem( menuitem );

        this._populated = true;

        return false;
    }

    _log( text ) {
        if ( DEBUG ) {
            global.log( TEXT_LOGID, [...arguments] );
        }
    }



    _getVMs() {
        let vms;
        try {
            // this._log( 'Run \'avdmanager list avd\'' );
            // GLib.spawn_sync( null, ['avdmanager'], null, GLib.SpawnFlags.SEARCH_PATH, null, null);
            // vms = GLib.spawn_command_line_sync( 'avdmanager list avd' );
            // vms = String(GLib.spawn_sync( null, ['avdmanager', 'list', 'avd'], {PATH: this.androidHome +'/tools/bin'}, GLib.SpawnFlags.SEARCH_PATH, null, null));
            
            this._log( "Run 'emulator -list-avds'" );
            vms = GLib.spawn_command_line_sync( 'emulator -list-avds' );
            if(vms[2]){      
                this._log( vms );   
            }   
        }
        catch (err) {
            this._log( err );
            Main.notifyError( TEXT_APPNAME + ': ' + err );
            return;
        }
        return this._parseVMList( vms[1] );
    }

    
    _parseVMList( vms ) {
        this._log( '_parseVMList: ' + vms);
        let res = [];
        if ( vms.length !== 0 ) {
            let lines = vms.toString().split('\n');

            for ( let i = 0; i < lines.length; i++ ) {
                let line = lines[i];
                if ( line === '' ) {
                    continue;
                }

                res.push({
                    id: line,
                    name: line.replace(/_/g, ' ')
                });
            }
        }
        return res;
    }

    _isVMRunning( id ) {
        let machines = this._getRunningVMs();
        return this.searchInVMs( machines, id );
    }

    _getRunningVMs() {
        // let vms;
        // try {
        //     this._log( 'Run \'vboxmanage list runningvms\'' );
        //     vms = String( GLib.spawn_command_line_sync( 'avdmanager list avd' )[1] );
        // }
        // catch (err) {
        //     this._log( err );
        //     return;
        // }

        // return this._parseVMList( vms );
        return [];
    }

    _onVisibilityChanged() {
        if ( this.menu.actor.visible && this._populated ) {
           GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, this._markRunning.bind(this) );
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

    // _activateWindow( name ) {
    //     let a = global.get_window_actors();
    //     for (var i = 0; i < a.length; i++)
    //     {
    //         let mw = a[i].metaWindow;
    //         let title = mw.get_title();

    //         if ( title.startsWith( name ) && title.toLowerCase().includes('virtualbox') ) {
    //             this._log( 'activate window: ' + title );
    //             mw.activate( global.get_current_time() );
    //         }
    //     }
    // }
});


function enable() {
    try {
        enabled = true;
        applet = new AVDApplet;
        Main.panel.addToStatusArea( TEXT_APPNAME, applet );
    } catch(e){
        global.log(TEXT_LOGID, e);
    }
}

function disable() {
    enabled = false;
    applet.destroy();
}
