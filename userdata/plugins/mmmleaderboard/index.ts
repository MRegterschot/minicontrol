import Plugin from "../../../core/plugins";
import Score from "../../../core/schemas/scores.model";
import MMMPoints from "../../schemas/mmmpoints.model";
import MMMRank from "../../schemas/mmmrank.model";

interface MMMScore {
    points: number;
    rank: number;
}

export default class MMMLeaderboard extends Plugin {
    static depends: string[] = ["game:Trackmania"];

    async onLoad() {
        try {
            await tmc.server.call("ChatEnableManualRouting", true, false);
            tmc.server.addListener("Trackmania.PlayerChat", this.onPlayerChat, this);
        } catch (e: any) {
            tmc.cli("ChatPlugin: ¤error¤ " + e.message);
        }

        tmc.storage["db"].addModels([MMMRank, MMMPoints]);
        tmc.server.addListener("Trackmania.EndMap_Start", this.onEndMap, this);
    }

    async onUnload() {
        try {
            await tmc.server.call("ChatEnableManualRouting", false, false);
        } catch (e: any) {
            console.log(e.message);
        }
        tmc.server.removeListener("Trackmania.EndMap_Start", this.onEndMap.bind(this));
        tmc.server.removeListener("Trackmania.PlayerChat", this.onPlayerChat);
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

        fullScores.forEach(async (fullScore) => {
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
            const rawPoints = normalizedPoints * (1 - minValue) + minValue;

            // Round the points up to the nearest integer
            return Math.ceil(rawPoints);
        };

        // Assign logarithmic points based on the position (which is determined by score)
        return scores.map((scoreEntry) => {
            // Find the index of the current scoreEntry in the sorted array
            const position = sortedScores.findIndex(item => item.login === scoreEntry.login) + 1;
            const points = calculatePoints(position, total, minValue) * multiplier;
            const mmmScore = { points, rank: position } as MMMScore;
            return { score: scoreEntry, mmmScore };
        });
    }
}
