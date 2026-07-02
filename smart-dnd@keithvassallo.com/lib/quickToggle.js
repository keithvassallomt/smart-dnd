import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {formatWhenShort} from './format.js';

function subtitleFor(status) {
    const nowMs = GLib.get_real_time() / 1000;
    if (status.active)
        return status.nextOffMs != null ? `Until ${formatWhenShort(nowMs, status.nextOffMs)}` : 'On';
    return status.nextOnMs != null ? formatWhenShort(nowMs, status.nextOnMs) : 'None scheduled';
}

export const SmartDndIndicator = GObject.registerClass(
class SmartDndIndicator extends QuickSettings.SystemIndicator {
    _init(extension, service) {
        super._init();

        const icon = Gio.icon_new_for_string(
            `${extension.path}/icons/hicolor/scalable/actions/smart-dnd-symbolic.svg`);

        this._toggle = new QuickSettings.QuickMenuToggle({
            title: 'Smart DND',
            subtitle: subtitleFor(service.getStatus()),
            gicon: icon,
            toggleMode: true,
        });
        extension.getSettings().bind('master-enabled',
            this._toggle, 'checked', Gio.SettingsBindFlags.DEFAULT);

        this._toggle.menu.setHeader(icon, 'Smart DND');
        this._toggle.menu.addAction('Settings', () => extension.openPreferences());

        this._statusUnsub = service.connect('status-changed', (status) => {
            this._toggle.subtitle = subtitleFor(status);
        });

        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        if (this._statusUnsub) {
            this._statusUnsub();
            this._statusUnsub = null;
        }
        Gio.Settings.unbind(this._toggle, 'checked');
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
