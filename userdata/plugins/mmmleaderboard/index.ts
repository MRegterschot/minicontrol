import { time } from "console";
import Plugin from "../../../core/plugins";
import Score from "../../../core/schemas/scores.model";
import MMMPoints from "../../schemas/mmmpoints.model";
import MMMRank from "../../schemas/mmmrank.model";
import PointsWindow from "./pointsWindow";
import LeaderboardWindow from "./leaderboardWindow";
import { clone, escape, formatTime } from "../../../core/utils";
import Player from "../../../core/schemas/players.model";

interface MMMScore {
    points: number;
    rank: number;
}

export default class MMMLeaderboard extends Plugin {
    static depends: string[] = ["game:Trackmania"];

    currentMapUid: string = "";
    leaderboard: MMMRank[] = [];
    records: any[] = [];

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
        tmc.chatCmd.addCommand("/leaderboard", this.cmdLeaderboard.bind(this), "Display MMM Leaderboard");
        tmc.chatCmd.addCommand("/points", this.cmdPoints.bind(this), "Display points");
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
        tmc.chatCmd.removeCommand("/leaderboard");
        tmc.chatCmd.removeCommand("/points");
    }

    async onStart() {
        const menu = tmc.storage["menu"];
        if (menu) {
            menu.addItem({
                category: "Players",
                title: "Show: Leaderboard",
                action: "/leaderboard",
            });

            menu.addItem({
                category: "Map",
                title: "Show: Points",
                action: "/points",
            });
        }
        if (!tmc.maps.currentMap?.UId) return;
        this.currentMapUid = tmc.maps.currentMap.UId;

        await this.syncLeaderboard();
        await this.syncRecords(this.currentMapUid);
        // this.test();
    }

    test() {
        tmc.server.emit("TMC.PlayerFinish", [
            "44f32K-wS_a7KYaNGmLeOw",
            26419,
            {
                time: 5292120,
                login: "44f32K-wS_a7KYaNGmLeOw",
                accountid: "e387f7d8-afb0-4bf6-bb29-868d1a62de3b",
                racetime: 26419,
                laptime: 26419,
                checkpointinrace: 1,
                checkpointinlap: 1,
                isendrace: true,
                isendlap: true,
                isinfinitelaps: false,
                isindependentlaps: false,
                curracecheckpoints: [],
                curlapcheckpoints: [],
                blockid: "#50331650",
                speed: 8.79688,
            },
        ]);
    }

    async cmdLeaderboard(login: string, args: string[]) {
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
                nickname: escape(rank.player.nickname),
                login: rank.login,
                points: rank.totalPoints,
            });
        }

        const window = new LeaderboardWindow(login, this);
        window.size = { width: 90, height: 95 };
        window.title = `Leaderboard [${ranks.length}]`;
        window.setItems(rankList);
        window.setColumns([
            { key: "rank", title: "Rank", width: 10 },
            { key: "nickname", title: "Nickname", width: 50 },
            { key: "points", title: "Points", width: 20 },
        ]);

        await window.display();
    }

    async cmdPoints(login: string, args: string[]) {
        const points = await MMMPoints.findAll({
            where: {
                mapUid: this.currentMapUid,
            },
            order: [["rank", "ASC"]],
            include: [
                {
                    model: tmc.storage["db"].models["Player"],
                    as: "player",
                },
            ],
        });

        let pointsList = [];

        for (const point of points) {
            pointsList.push({
                // @ts-expect-error
                nickname: point.player.nickname,
                login: point.login,
                points: point.points,
                rank: point.rank,
                time: "$o" + formatTime(point.time ?? 0),
            });
        }

        const window = new PointsWindow(login, this);
        window.size = { width: 110, height: 95 };
        window.title = `Map Points [${points.length}]`;
        window.setItems(pointsList);
        window.setColumns([
            { key: "rank", title: "Rank", width: 10 },
            { key: "nickname", title: "Nickname", width: 50 },
            { key: "points", title: "Points", width: 20 },
            { key: "time", title: "Time", width: 20 },
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
                    time: score.time,
                });
            } else {
                playerPoints.update({
                    points: mmmScore.points,
                    rank: mmmScore.rank,
                    time: score.time,
                });
            }
        }

        this.calculatePlayerRanks();
    }

    async syncLeaderboard() {
        const ranks = await MMMRank.findAll({
            order: [["rank", "ASC"]],
            include: [Player],
        });

        this.leaderboard = ranks;

        tmc.server.emit("Plugin.MMMLeaderboard.onSync", {
            leaderboard: clone(this.leaderboard),
        });
    }

    async syncRecords(mapUid: string) {
        const scores = await Score.findAll({
            where: {
                mapUuid: mapUid
            },
            order: [
                // Will escape title and validate DESC against a list of valid direction parameters
                ['time', 'ASC'],
                ['updatedAt', 'ASC'],
            ],
            include: [Player],
        });

        this.records = [];
        let rank = 1;
        for (const score of scores) {
            score.rank = rank;
            this.records.push(score);
            rank += 1;
        }

        tmc.server.emit("Plugin.Records.onSync", {
            mapUid: mapUid,
            records: clone(this.records)
        });
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
            const position = sortedScores.findIndex((item) => item.login === scoreEntry.login) + 1;
            const points = Math.ceil(calculatePoints(position, total, minValue) * multiplier);
            const mmmScore = { points, rank: position } as MMMScore;
            return { score: scoreEntry, mmmScore };
        });
    }
}
