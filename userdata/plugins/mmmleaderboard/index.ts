import Plugin from "../../../core/plugins";
import Score from "../../../core/schemas/scores.model";
import MMMPoints from "../../schemas/mmmpoints.model";
import MMMRank from "../../schemas/mmmrank.model";
import RanksWindow from "./ranksWindow";

interface MMMScore {
    points: number;
    rank: number;
}

export default class MMMLeaderboard extends Plugin {
    static depends: string[] = ["game:Trackmania"];

    currentMapUid: string = "";
    points: MMMPoints[] = [];

    async onLoad() {
        try {
            await tmc.server.call("ChatEnableManualRouting", true, false);
            tmc.server.addListener("Trackmania.PlayerChat", this.onPlayerChat, this);
        } catch (e: any) {
            tmc.cli("ChatPlugin: ¤error¤ " + e.message);
        }

        tmc.storage["db"].addModels([MMMRank, MMMPoints]);
        tmc.server.addListener("Trackmania.EndMap_Start", this.onEndMap, this);
        tmc.server.addListener("Trackmania.BeginMap", this.onBeginMap, this);
        tmc.chatCmd.addCommand("/ranks", this.cmdRanks.bind(this), "Display ranks");
    }

    async onUnload() {
        try {
            await tmc.server.call("ChatEnableManualRouting", false, false);
        } catch (e: any) {
            console.log(e.message);
        }
        tmc.server.removeListener("Trackmania.EndMap_Start", this.onEndMap.bind(this));
        tmc.server.removeListener("Trackmania.BeginMap", this.onBeginMap.bind(this));
        tmc.server.removeListener("Trackmania.PlayerChat", this.onPlayerChat);
        tmc.chatCmd.removeCommand("/ranks");
    }

    async onStart() {
        const menu = tmc.storage["menu"];
        if (menu) {
            menu.addItem({
                category: "Players",
                title: "Show: Ranks",
                action: "/ranks",
            });
        }
        if (!tmc.maps.currentMap?.UId) return;
        this.currentMapUid = tmc.maps.currentMap.UId;
    }

    async cmdRanks(login: string, args: string[]) {
        const ranks = await MMMRank.findAll({
            order: [["rank", "ASC"]],
            include: [
                {
                    model: tmc.storage["db"].models["Player"],
                    as: "player",
                },
            ],
        });

        let rankList = [];
        for (const rank of ranks) {
            rankList.push({
                rank: rank.rank,
                // @ts-expect-error
                nickname: rank.player.nickname,
                login: rank.login,
                points: rank.totalPoints,
            });
        }

        const window = new RanksWindow(login, this);
        window.size = { width: 90, height: 95 };
        window.title = `Server Ranks [${ranks.length}]`;
        window.setItems(rankList);
        window.setColumns([
            { key: "rank", title: "Rank", width: 10 },
            { key: "nickname", title: "Nickname", width: 50 },
            { key: "points", title: "Points", width: 20 },
        ]);

        await window.display();
    }

    async onBeginMap(data: any) {
        const map = data[0];
        this.currentMapUid = map.UId;
    }

    async onEndMap(data: any) {
        const mapUid = data.map?.uid;

        if (!mapUid) return;

        const mapScores = await Score.findAll({
            where: {
                mapUuid: mapUid,
            },
            order: [["time", "DESC"]],
        });

        const fullScores = this.calculateLogarithmicPoints(mapScores);

        for (const fullScore of fullScores) {
            const score = fullScore.score;
            const mmmScore = fullScore.mmmScore;

            if (!score.time) return;

            const playerPoints = await MMMPoints.findOne({
                where: {
                    login: score.login,
                    mapUid: mapUid,
                },
            });

            const playerRank = await MMMRank.findOne({
                where: {
                    login: score.login,
                },
            });

            if (!playerRank) {
                await MMMRank.create({
                    login: score.login,
                    totalPoints: mmmScore.points,
                });
            } else {
                let points = playerRank.totalPoints;
                if (playerPoints?.points) points -= playerPoints.points;
                playerRank.update({
                    totalPoints: points + mmmScore.points,
                });
            }

            if (!playerPoints) {
                await MMMPoints.create({
                    login: score.login,
                    mapUid: mapUid,
                    points: mmmScore.points,
                    rank: mmmScore.rank,
                });
            } else {
                playerPoints.update({
                    points: mmmScore.points,
                    rank: mmmScore.rank,
                });
            }
        }

        this.calculatePlayerRanks();
    }

    async onPlayerChat(data: any) {
        if (data[0] == 0) return;
        if (data[2].startsWith("/")) return;

        const player = await tmc.getPlayer(data[1]);
        const playerRank = await MMMRank.findOne({
            where: {
                login: player.login,
            },
        });
        const nick = player.nickname.replaceAll(/\$[iwozs]/gi, "");
        const text = data[2];
        let msg = `${nick}$z$s$fff »$ff0 ${text}`;
        if (playerRank?.rank && playerRank?.rank != 0) {
            msg = `[${playerRank?.rank}] ${msg}`;
        }
        tmc.server.send("ChatSendServerMessage", msg);
        tmc.cli(msg);
    }

    async calculatePlayerRanks() {
        const players = await MMMRank.findAll();

        const sortedPlayers = players.sort((a, b) => b.totalPoints - a.totalPoints);

        sortedPlayers.forEach(async (player, index) => {
            player.update({
                rank: index + 1,
            });
        });

        tmc.cli("Ranks updated!");
    }

    calculateLogarithmicPoints(scores: Score[], minValue: number = 0.2, multiplier: number = 1000): { score: Score; mmmScore: MMMScore }[] {
        // Sort scores based on their score (lowest score is the best)
        const sortedScores = scores.sort((a, b) => (a.time && b.time ? a.time - b.time : 0));

        // Total number of scores
        const total = sortedScores.length;

        // Custom log function with fixed base (dropoffFactor = 10)
        const logBase = (x: number): number => {
            const dropoffFactor = 10; // Fixed dropoffFactor
            return Math.log(x) / Math.log(dropoffFactor); // Change the log base using dropoffFactor 10
        };

        // Function to calculate logarithmic points with min value control and rounding up
        const calculatePoints = (position: number, total: number, minValue: number): number => {
            const maxLog = logBase(total + 1); // Log with fixed dropoffFactor (10)
            const normalizedPoints = (maxLog - logBase(position)) / maxLog;

            // Scale and shift the points to ensure a minimum value
            return normalizedPoints * (1 - minValue) + minValue;
        };

        // Assign logarithmic points based on the position (which is determined by score)
        return scores.map((scoreEntry) => {
            // Find the index of the current scoreEntry in the sorted array
            const position = sortedScores.findIndex(item => item.login === scoreEntry.login) + 1;
            const points = Math.ceil(calculatePoints(position, total, minValue) * multiplier);
            const mmmScore = { points, rank: position } as MMMScore;
            return { score: scoreEntry, mmmScore };
        });
    }
}
