import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {DndService} from './lib/dndService.js';
import {SmartDndIndicator} from './lib/quickToggle.js';

export default class SmartDndExtension extends Extension {
    enable() {
        this._service = new DndService(this.getSettings());
        this._service.start();
        this._indicator = new SmartDndIndicator(this, this._service);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
        this._service.stop();
        this._service = null;
    }
}
