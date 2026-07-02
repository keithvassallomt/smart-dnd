import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {DndService} from './lib/dndService.js';
import {SmartDndIndicator} from './lib/quickToggle.js';

export default class SmartDndExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._service = new DndService(this._settings);
        this._service.start();
        this._indicator = null;
        this._syncIndicator();
        this._settings.connectObject('changed::show-quick-settings',
            () => this._syncIndicator(), this);
    }

    disable() {
        this._settings.disconnectObject(this);
        this._removeIndicator();
        this._service.stop();
        this._service = null;
        this._settings = null;
    }

    _syncIndicator() {
        const wanted = this._settings.get_boolean('show-quick-settings');
        if (wanted && !this._indicator) {
            this._indicator = new SmartDndIndicator(this, this._service);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        } else if (!wanted && this._indicator) {
            this._removeIndicator();
        }
    }

    _removeIndicator() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
