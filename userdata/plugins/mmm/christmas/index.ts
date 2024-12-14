import type { Player } from "@core/playermanager";
import Plugin from "@core/plugins";
import Manialink from "@core/ui/manialink";

export default class Info extends Plugin {
    static depends: string[] = [];
    widgets: { [key: string]: Manialink } = {};

    async onLoad() {
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
		tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
		this.updateWidgets();
    }

    async onUnload() {
        for (const login of Object.keys(this.widgets)) {
            delete this.widgets[login];
        }
        tmc.server.removeListener("TMC.PlayerConnect", this.onPlayerConnect);
        tmc.server.removeListener("TMC.PlayerDisconnect", this.onPlayerDisconnect);
    }

    async onPlayerConnect(player: Player) {
        const login = player.login;
        await this.updateWidget(login);
        if (this.widgets[login]) {
            await tmc.ui.displayManialink(this.widgets[login]);
        }
    }

	async onPlayerDisconnect(player: Player) {
        const login = player.login;
        if (this.widgets[login]) {
            delete this.widgets[login];
        }
    }

	async updateWidgets() {
        for (const player of tmc.players.getAll()) {
            await this.updateWidget(player.login);
        }
        await tmc.ui.displayManialinks(Object.values(this.widgets));
    }

	async updateWidget(login: string) {
		let widget = new Manialink(login);

		widget.template = 'userdata/plugins/mmm/christmas/christmas.twig';

		this.widgets[login] = widget;
	}
}
