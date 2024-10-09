import Score from "@core/schemas/scores.model";
import Plugin from "../../../../core/plugins";
import OnlinePlayers from "../../../schemas/onlineplayers.model";
import { Player as PlayerM } from "@core/playermanager";
import Player from "@core/schemas/players.model";
import MMMRank from "../../../schemas/mmmrank.model";

export default class MMMData extends Plugin {
    static depends: string[] = ["game:Trackmania", "database"];

    currentMapUid: string = "";
    serverLogin: string = process.env.SERVER_LOGIN || "";

    async onLoad() {
        tmc.storage["db"].addModels([Score, OnlinePlayers]);
        tmc.server.addListener("Trackmania.BeginMap", this.onBeginMap, this);
        tmc.server.addListener("TMC.PlayerFinish", this.onPlayerFinish, this);
		tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
    }

    async onUnload() {
        tmc.server.removeListener("Trackmania.BeginMap", this.onBeginMap.bind(this));
        tmc.server.removeListener("TMC.PlayerFinish", this.onPlayerFinish.bind(this));
		tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
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

            await OnlinePlayers.bulkCreate(
                players.map((player) => {
                    return {
                        login: player.login,
                        serverLogin: this.serverLogin,
                    };
                })
            );

            tmc.cli("Online players updated.");
        } catch (e: any) {
            tmc.cli("Error updating online players: " + e.message);
        }
    }

	async onPlayerConnect(player: PlayerM) {
		const playerData = await Player.findOne({ where: { login: player.login } });
		
		if (!playerData || (!playerData.lastPoints && !playerData.lastRank)) return;
		
		const currentRank = await MMMRank.findOne({ where: { login: player.login } });
		
		if (!currentRank) return;
		
		let pointMessage = "";
		let pointDiff = currentRank.totalPoints - (playerData.lastPoints ?? 0);
		if (pointDiff != 0) {
			pointMessage = `You ${pointDiff > 0 ? "gained" : "lost"} ${Math.abs(pointDiff)} point${Math.abs(pointDiff) > 1 ? "s" : ""}`;
		}
		
		let rankMessage = "";
		if (currentRank.rank) {
			let rankDiff = currentRank.rank - (playerData.lastRank ?? 0);
			if (rankDiff != 0) {
				rankMessage = `${pointMessage ? " and you" : "You"} ${rankDiff > 0 ? "lost" : "gained"} ${Math.abs(rankDiff)} rank${Math.abs(rankDiff) > 1 ? "s" : ""}`;
			}
		}
		
		if (pointMessage || rankMessage) tmc.chat(`Welcome back, ${player.nickname}! ${pointMessage}${rankMessage} since your last visit.`, player.login);
		
		await Player.update({ lastPoints: currentRank.totalPoints, lastRank: currentRank.rank }, { where: { login: player.login } });
	}
	
	async onPlayerDisconnect(player: any) {
		const playerData = await Player.findOne({ where: { login: player.login } });

		if (!playerData) return;

		const currentRank = await MMMRank.findOne({ where: { login: player.login } });

		if (!currentRank) return;

		await Player.update({ lastPoints: currentRank.totalPoints, lastRank: currentRank.rank }, { where: { login: player.login } });
	}
}
