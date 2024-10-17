import type { Player as PlayerM } from "@core/playermanager";
import Plugin from "@core/plugins";
import Player from "@core/schemas/players.model";
import IntroWindow from "./introWindow";
import fs from "fs";

export default class Info extends Plugin {
    static depends: string[] = ["database"];

    windows: { [key: string]: IntroWindow } = {};

	path: string = "userdata/plugins/mmm/info/windows";
	windowFiles: string[] = [];

    async onLoad() {
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);

		tmc.addCommand("//intro", async (login: string, args: string[]) => {
			const page = parseInt(args[0]) || 0;
			await this.manageIntro(login, page);
		});

		this.windowFiles = fs.readdirSync(this.path);
    }

    async onUnload() {
		for (const login of Object.keys(this.windows)) {
            delete this.windows[login];
        }
        tmc.server.removeListener("TMC.PlayerConnect", this.onPlayerConnect);
        tmc.server.removeListener("TMC.PlayerDisconnect", this.onPlayerDisconnect);
    }

    async onPlayerConnect(player: PlayerM) {
        const login = player.login;

        const playerModel = await Player.findOne({
            where: {
                login,
            },
        });

        if (playerModel?.introSkipped) return;

        await this.manageIntro(login, 0);
    }

    async onPlayerDisconnect(player: PlayerM) {
		const login = player.login;
		if (this.windows[login]) {
			delete this.windows[login];
		}
	}

	async manageIntro(login: string, page: number) {
        if (page >= this.windowFiles.length) return;
        
		let window = new IntroWindow(login, this.windowFiles.length);
		window.template = `${this.path}/${this.windowFiles[page]}`;
        window.setPage(page);
        window.pos.y = 0;
        
        window.actions['prev'] = tmc.ui.addAction(this.manageIntro.bind(this, login, page - 1), []);
        window.actions['next'] = tmc.ui.addAction(this.manageIntro.bind(this, login, page + 1), []);
        
        await window.display();
		if (this.windows[login]) {
			await this.windows[login].destroy();
		}
        this.windows[login] = window;
	}
}
 