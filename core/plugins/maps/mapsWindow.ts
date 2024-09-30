import { Op } from 'sequelize';
import MMMPoints from '../../../userdata/schemas/mmmpoints.model';
import type { Map } from '../../mapmanager';
import Confirm from '../../ui/confirm';
import ListWindow from '../../ui/listwindow';
import { formatTime, escape, clone, removeColors } from '../../utils';

enum Medals {
    Author = 0,
    Gold = 1,
    Silver = 2,
    Bronze = 3,
    None = 4
}

export default class MapsWindow extends ListWindow {
    params: string[] = [];
    template: string = "core/plugins/maps/maplist.twig"
    pageSize = 20;
    ranks: { [key: string]: { mapUid: string, rank: number, medal: Medals }[] } = {};

    constructor(login: string, params: string[]) {
        super(login);
        this.params = params;
    }

    async uiPaginate(login: string, answer: any, entries: any): Promise<void> {
        let maps: any[] = [];
        let i = 1;
        let serverMaps = clone(tmc.maps.get());
        await this.getPersonalRank(login, serverMaps);
        for (const map of serverMaps) {
            if (!this.params[0] ||
                (
                    removeColors(map.Name).toLocaleLowerCase().indexOf(this.params[0].toLocaleLowerCase()) !== -1 ||
                    removeColors(map.AuthorName).toLocaleLowerCase().indexOf(this.params[0].toLocaleLowerCase()) !== -1 ||
                    removeColors(map.Environnement).toLocaleLowerCase().indexOf(this.params[0].toLocaleLowerCase()) !== -1 ||
                    removeColors(map.Vehicle).toLocaleLowerCase().indexOf(this.params[0].toLocaleLowerCase()) !== -1
                )
            ) {
                maps.push(
                    Object.assign(map, {
                        Index: i++,
                        Name: escape(map.Name),
                        AuthorName: escape(map.AuthorNickname || map.Author || ""),
                        ATime: formatTime(map.AuthorTime || map.GoldTime),
                        Rank: this.ranks[login].find((rank) => rank.mapUid == map.UId)?.rank || 99999,
                        Medal: this.ranks[login].find((rank) => rank.mapUid == map.UId)?.medal ?? Medals.None
                    })
                );
            }
        }
        this.setItems(maps);
        super.uiPaginate(login, answer, entries);
    }

    async onAction(login: string, action: string, item: any) {
        if (action == "Jump") {
            await tmc.chatCmd.execute(login, "//jump " + item.Uid);
        } else if (action == "Remove") {
            const confirm = new Confirm(login, "Confirm Remove", this.applyCommand.bind(this), [login, "//remove " + item.UId]);
            await confirm.display();
        } else if (action == "Queue") {
            await tmc.chatCmd.execute(login, "/addqueue " + item.UId);
        }
    }

    async applyCommand(login: string, action: string) {
        await tmc.chatCmd.execute(login, action);
        await this.uiPaginate(login, "", []);
    }

    async getPersonalRank(login: string, maps: Map[]) {
        const mmmPoints = await MMMPoints.findAll({
            where: {
                login: login,
                mapUid: {
                    [Op.in]: maps.map((map) => map.UId)
                }
            }
        });

        this.ranks[login] = mmmPoints.map((point) => {
            let medal = Medals.None;

            if (point.time <= (maps.find((map) => map.UId == point?.mapUid)?.AuthorTime ?? 0)) {
                medal = Medals.Author;
            } else if (point.time <= (maps.find((map) => map.UId == point?.mapUid)?.GoldTime ?? 0)) {
                medal = Medals.Gold;
            } else if (point.time <= (maps.find((map) => map.UId == point?.mapUid)?.SilverTime ?? 0)) {
                medal = Medals.Silver;
            } else if (point.time <= (maps.find((map) => map.UId == point?.mapUid)?.BronzeTime ?? 0)) {
                medal = Medals.Bronze;
            }

            return {
                mapUid: point.mapUid ?? "",
                rank: point.rank ?? 99999,
                medal: medal
            };
        });
    }
}