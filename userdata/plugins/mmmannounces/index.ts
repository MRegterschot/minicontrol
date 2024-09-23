import type { Player } from "../../../core/playermanager";
import Plugin from "../../../core/plugins";
import { formatTime } from "../../../core/utils";

export default class Announces extends Plugin {
    async onLoad() {
        //   tmc.server.addListener("Trackmania.BeginMap", this.onBeginMap, this);
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
        tmc.server.addListener("Plugin.MMMRecords.onNewRecord", this.onNewRecord, this);
        tmc.server.addListener("Plugin.MMMRecords.onUpdateRecord", this.onUpdateRecord, this);
        tmc.server.addListener("Plugin.MMMRecords.onSync", this.onSyncRecord, this);   
        tmc.server.addListener("Trackmania.BeginMap", this.onBeginMap, this);
    }

    async onStart() {
        await this.onBeginMap([tmc.maps.currentMap]);
    }

    async onUnload() {
        tmc.server.removeListener("Trackmania.BeginMap", this.onBeginMap);
        tmc.server.removeListener("TMC.PlayerConnect", this.onPlayerConnect);
        tmc.server.removeListener("TMC.PlayerDisconnect", this.onPlayerDisconnect);
        tmc.server.removeListener("Plugin.MMMRecords.onNewRecord", this.onNewRecord);
        tmc.server.removeListener("Plugin.MMMRecords.onUpdateRecord", this.onUpdateRecord);
        tmc.server.removeListener("Plugin.MMMRecords.onSync", this.onSyncRecord);
    }

    async onBeginMap(data: any) {
        const info = tmc.maps.getMap(data[0].UId) || data[0];
        const msg = `¤info¤${info.Environnement} map ¤white¤${info?.Name.replaceAll(/\$s/gi, "")}¤info¤ by ¤white¤${info.AuthorNickname ? info.AuthorNickname : info.Author}`;
        tmc.chat(msg);
        tmc.cli(msg);
    }

    async onPlayerConnect(player: Player) {
        tmc.chat(`${tmc.brand} ¤info¤version ¤white¤${tmc.version}`, player.login);
        const msg = `¤white¤${player.nickname}¤info¤ from ¤white¤${player.path.replace("World|", "").replaceAll("|", ", ")} ¤info¤joins!`;
        tmc.chat(msg);
        tmc.cli(msg);
    }

    async onPlayerDisconnect(player: any) {
        const msg = `¤white¤${player.nickname}¤info¤ leaves!`;
        tmc.chat(msg);
        tmc.cli(msg);
    }

    async onNewRecord(data: any) {
        let record = data.record;
        tmc.chat(`¤white¤${record.nickname}¤rec¤ has set a new $fff1. ¤rec¤ record ¤white¤${formatTime(record.time)}¤rec¤! ¤white¤+${record.points} points¤rec¤!`);
    }

    async onUpdateRecord(data: any) {
        const newRecord = data.record;
        const oldRecord = data.oldRecord;

        let extrainfo = "";
        if (oldRecord.rank) {
            extrainfo = `(¤gray¤$n${formatTime(newRecord.time - oldRecord.time).replace("0:", "")}$m¤rec¤)`;
        }

        let recipient = undefined;
        if (newRecord.rank > 5) {
            recipient = newRecord.login;
        }

        if (recipient) {
            tmc.chat(`¤white¤You¤rec¤ set ¤white¤${newRecord.rank}. ¤rec¤ record ¤white¤${formatTime(newRecord.time)}¤rec¤ ${extrainfo}! ¤white¤+${newRecord.points - oldRecord.points ?? 0} points¤rec¤!`, recipient);
        } else {
            tmc.chat(`¤white¤${newRecord.nickname}¤rec¤ set ¤white¤${newRecord.rank}. ¤rec¤ record ¤white¤${formatTime(newRecord.time)}¤rec¤ ${extrainfo}! ¤white¤+${newRecord.points - oldRecord.points ?? 0} points¤rec¤!`);
        }
    }

    async onSyncRecord(data: any) {
        const records: any[] = data.records;
        if (records.length === 0) {            
            return;
        }
        const msg = `¤rec¤Server record ¤white¤${records[0].nickname}¤rec¤ time ¤white¤${records[0].formattedTime}`; 
        tmc.chat(msg);
    }
}

 