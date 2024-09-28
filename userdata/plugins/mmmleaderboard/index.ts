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

const rankNames: { [key: number]: any } = {
    0: {
        name: "Beginner",
        color: "$FFF",
    },
    2500: {
        name: "Bronze",
        color: "$B60",
    },
    5000: {
        name: "Silver",
        color: "$BBB",
    },
    10000: {
        name: "Gold",
        color: "$FC0",
    },
    25000: {
        name: "Emerald",
        color: "$0D0",
    },
    50000: {
        name: "Diamond",
        color: "$0EF",
    },
    100000: {
        name: "Master",
        color: "$A2F",
    },
    250000: {
        name: "Grandmaster",
        color: "$C20",
    },
    500000: {
        name: "Minimaster",
        color: "$F70",
    },
};

const rankChangeMessages: { [key: string]: string[] } = {
    promoted: ["EZ", "Nice", "Good job", "Well done", "Congratulations", "Amazing", "Incredible", "Unbelievable", "Godlike", "Legendary"],
    demoted: ["RIP", "Oof", "Unlucky", "Bad luck", "Better luck next time", "Try harder", "You can do it", "You got this", "Keep going", "Don't give up", "LOL"],
}

export default class MMMLeaderboard extends Plugin {
    static depends: string[] = ["game:Trackmania", "database"];

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
        tmc.server.addListener("TMC.PlayerFinish", this.onPlayerFinish, this);
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
        tmc.server.removeListener("TMC.PlayerFinish", this.onPlayerFinish.bind(this));
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
        
        await this.calculateFullPointsAndRanks();
        await this.syncRecords();
    }

    async onPlayerFinish(data: any) {
        const login = data[0];
        const player = await tmc.players.getPlayer(login);
        try {
            let scores = await MMMPoints.findAll({
                where: {
                    mapUid: tmc.maps.currentMap?.UId,
                },
                include: [Player],
            });

            let score: any = scores.find((score: MMMPoints) => score.login === login);
            let prevScore = clone(score);

            let newScore = false;

            if (!score) {
                newScore = true;
                score = {
                    login: login,
                    time: data[1],
                };
            } else {
                if (score.time <= data[1]) return;
                score.time = data[1];
            }

            let mmmScores = this.calculateLogarithmicPoints(newScore ? [...scores, score] : scores);

            if (newScore) {
                let mmmScore = mmmScores.find((mmmScore) => mmmScore.score.login === login);

                if (!mmmScore) return;

                score = await MMMPoints.create({
                    login: login,
                    mapUid: tmc.maps.currentMap?.UId,
                    points: mmmScore.mmmScore.points,
                    rank: mmmScore.mmmScore.rank,
                    time: data[1],
                });

                scores.push(score);
            }

            scores = scores.sort((a, b) => a.time - b.time);

            this.records = [];

            for (let mmmScore of mmmScores) {
                // @ts-expect-error
                let name = mmmScore.score?.player?.nickname;

                if (!name) {
                    let player = await tmc.players.getPlayer(mmmScore.score.login || "");
                    name = player.nickname;
                }

                this.records.push({
                    login: mmmScore.score.login,
                    formattedTime: formatTime(mmmScore.score.time),
                    points: mmmScore.mmmScore.points,
                    rank: mmmScore.mmmScore.rank,
                    nickname: escape(name),
                });
            }

            let playerScore = mmmScores.find((score) => score.score.login === login);

            if (!playerScore) return;

            if (playerScore.mmmScore.rank === 1) {
                tmc.server.emit("Plugin.MMMRecords.onNewRecord", {
                    record: {
                        nickname: player.nickname,
                        time: playerScore.score.time,
                        points: playerScore.mmmScore.points - (prevScore?.points ?? 0),
                    },
                    records: clone(this.records),
                });
            } else {
                tmc.server.emit("Plugin.MMMRecords.onUpdateRecord", {
                    record: {
                        login: player.login,
                        nickname: player.nickname,
                        time: playerScore.score.time,
                        points: playerScore.mmmScore.points,
                        rank: playerScore.mmmScore.rank,
                    },
                    oldRecord: {
                        nickname: player.nickname,
                        time: prevScore?.time,
                        points: prevScore?.points ?? 0,
                        rank: prevScore?.rank,
                    },
                    records: clone(this.records),
                });
            }

            for (let score of scores) {
                let mmmScore = mmmScores.find((mmmScore) => mmmScore.score.login === score.login);
                if (!mmmScore) return;

                score.set({
                    points: mmmScore.mmmScore.points,
                    rank: mmmScore.mmmScore.rank,
                });
                await score.save();
            }
        } catch (e: any) {
            console.log(e);
        }
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
                mapUid: tmc.maps.currentMap?.UId,
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
        this.syncRecords();
    }

    async onEndMap(data: any) {
        tmc.chat("Don't forget to vote for the map!");
        this.calculateFullPointsAndRanks();
    }

    async syncLeaderboard(ranks: MMMRank[] | undefined = undefined) {
        if (!ranks)
            ranks = await MMMRank.findAll({
                order: [["rank", "ASC"]],
                include: [Player],
            });

        this.leaderboard = ranks;

        tmc.server.emit("Plugin.MMMLeaderboard.onSync", {
            leaderboard: clone(this.leaderboard),
        });
    }

    async syncRecords() {
        let mapUid = tmc.maps.currentMap?.UId;

        const records = await MMMPoints.findAll({
            where: {
                mapUid: mapUid,
            },
            order: [["points", "DESC"]],
            include: [Player],
        });

        this.records = records.map((record) => {
            return {
                login: record.login,
                formattedTime: formatTime(record.time),
                points: record.points,
                rank: record.rank,
                // @ts-expect-error
                nickname: escape(record.player.nickname),
            };
        });

        tmc.server.emit("Plugin.MMMRecords.onSync", {
            mapUid: mapUid,
            records: clone(this.records),
        });
    }

    async calculateFullPointsAndRanks() {
        let points = await MMMPoints.findAll();

        let playerScores: { [key: string]: number } = {};

        points.forEach((point) => {
            const login = point.login ?? "";
            if (!playerScores[login]) {
                playerScores[login] = 0;
            }
            playerScores[login] += point.points;
        });

        for (const login of Object.keys(playerScores)) {
            let playerRank = await MMMRank.findOne({
                where: {
                    login: login,
                },
            });

            if (!playerRank) {
                playerRank = await MMMRank.create({
                    login: login,
                    totalPoints: playerScores[login],
                    rankName: "Beginner",
                });
            } else {
                playerRank.set({
                    totalPoints: playerScores[login],
                });
                await playerRank.save();
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

        let playerRankRange = this.getPlayerRankRange(playerRank);

        let msg = `${nick} $z$s» ${text}`;

        if (playerRank?.rank && playerRank?.rank != 0) {
            msg = `${playerRankRange.color}[${playerRank?.rank}]$fff ${msg}`;
        }

        tmc.server.send("ChatSendServerMessage", msg);
        tmc.cli(msg);
    }

    getPlayerRankRange(playerRank: MMMRank | null) {
        // find the rank name where the players total points is more than the highest rank
        let rankName = "Beginner";
        let color = "$FFF";
        for (let rank of Object.keys(rankNames)) {
            if ((playerRank?.totalPoints ?? 0) >= parseInt(rank)) {
                rankName = rankNames[parseInt(rank)].name;
                color = rankNames[parseInt(rank)].color;
            }
        }

        return {
            rankName,
            color,
        };
    }

    async calculatePlayerRanks() {
        const players = await MMMRank.findAll({
            include: [Player],
        });

        const sortedPlayers = players.sort((a, b) => b.totalPoints - a.totalPoints);

        for (let i = 0; i < sortedPlayers.length; i++) {
            let playerRankRange = this.getPlayerRankRange(sortedPlayers[i]);

            let rankName = sortedPlayers[i].rankName;

            if (playerRankRange.rankName !== sortedPlayers[i].rankName) {
                // find the points of the rank names
                let oldPoints = Object.keys(rankNames).find((key) => rankNames[key as any].name === sortedPlayers[i].rankName);
                let newPoints = Object.keys(rankNames).find((key) => rankNames[key as any].name === playerRankRange.rankName);

                let status = "promoted";
                
                if (parseInt(oldPoints ?? "0") > parseInt(newPoints ?? "0")) {
                    status = "demoted";
                }
                
                let rankChangeMessage = rankChangeMessages[status][Math.floor(Math.random() * rankChangeMessages[status].length)];
                rankName = playerRankRange.rankName;

                tmc.chat(
                    // @ts-expect-error
                    `$fff${sortedPlayers[i].player.nickname ?? (await tmc.players.getPlayer(playerRank.login)).nickname} ¤info¤${status} to $fff${playerRankRange.color}${
                        playerRankRange.rankName
                    }! $fff${rankChangeMessage}!`
                );
            }

            await sortedPlayers[i].update({
                rank: i + 1,
                rankName: rankName,
            });
        }

        tmc.cli("Ranks updated!");

        this.syncLeaderboard(sortedPlayers);
    }

    calculateLogarithmicPoints(scores: MMMPoints[], minValue: number = 0.2, multiplier: number = 1000): { score: MMMPoints; mmmScore: MMMScore }[] {
        // Sort scores based on their score (lowest score is the best) if same time, then updated time
        const sortedScores = scores.sort((a, b) => {
            // First compare by time if both have the `time` property
            if (a.time && b.time) {
                const timeDiff = a.time - b.time;
                // If the times are different, return the difference
                if (timeDiff !== 0) {
                    return timeDiff;
                }
            }
            // If times are the same (or one is missing), sort by updatedAt
            if (a.updatedAt && b.updatedAt) {
                return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            }
            return 0;
        });

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
