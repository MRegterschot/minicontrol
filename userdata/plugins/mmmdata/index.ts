import Score from "@core/schemas/scores.model";
import Plugin from "../../../core/plugins";
import OnlinePlayers from "../../schemas/onlineplayers.model";

export default class MMMData extends Plugin {
	static depends: string[] = ["game:Trackmania", "database"];

	currentMapUid: string = "";

	async onLoad() {
		tmc.storage["db"].addModels([Score, OnlinePlayers]);
		tmc.server.addListener("Trackmania.BeginMap", this.onBeginMap, this);
        tmc.server.addListener("TMC.PlayerFinish", this.onPlayerFinish, this);
	}

	async onUnload() {
		tmc.server.removeListener("Trackmania.BeginMap", this.onBeginMap.bind(this));
        tmc.server.removeListener("TMC.PlayerFinish", this.onPlayerFinish.bind(this));
	}

	async onStart() {
        if (!tmc.maps.currentMap?.UId) return;
        this.currentMapUid = tmc.maps.currentMap.UId;
		await this.checkOnlinePlayers();
    }

    async onBeginMap(data: any) {
        const map = data[0];
        this.currentMapUid = map.UId;
    }

	async onPlayerFinish(data: any) {
		try {
            Score.create({
                login: data[0],
                time: data[1],
                mapUuid: this.currentMapUid,
            });
        } catch (e: any) {
            console.log(e);
        }
	}

	async checkOnlinePlayers() {
		setTimeout(this.checkOnlinePlayers.bind(this), 1000 * 60);

		try {
			const players = tmc.players.getAll();
		
			await OnlinePlayers.bulkCreate(players.map((player) => {
				return {
					login: player.login,
				};
			}));

			tmc.cli("Online players updated.");
		} catch (e: any) {
			tmc.cli("Error updating online players: " + e.message);
		}
	}
}
