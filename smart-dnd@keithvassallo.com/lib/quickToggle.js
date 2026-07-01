import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

function subtitleFor(status) {
    if (!status.active) return 'Idle';
    if (status.reason === 'schedule') return 'On (scheduled)';
    if (status.reason === 'calendar') return 'On during event';
    return 'On';
}

export const SmartDndIndicator = GObject.registerClass(
class SmartDndIndicator extends QuickSettings.SystemIndicator {
    _init(extension, service) {
        super._init();

        this._toggle = new QuickSettings.QuickMenuToggle({
            title: 'Smart DND',
            subtitle: subtitleFor(service.getStatus()),
            iconName: 'notifications-disabled-symbolic',
            toggleMode: true,
        });
        extension.getSettings().bind('master-enabled',
            this._toggle, 'checked', Gio.SettingsBindFlags.DEFAULT);

        this._toggle.menu.setHeader('notifications-disabled-symbolic', 'Smart DND');
        this._toggle.menu.addAction('Settings', () => extension.openPreferences());

        service.connect('status-changed', (status) => {
            this._toggle.subtitle = subtitleFor(status);
        });

        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        Gio.Settings.unbind(this._toggle, 'checked');
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
