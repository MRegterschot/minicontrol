import { Op } from 'sequelize';
import MMMPoints from '../../../userdata/schemas/mmmpoints.model';
import type { Map } from '../../mapmanager';
import Confirm from '../../ui/confirm';
import ListWindow from '../../ui/listwindow';
import { formatTime, escape, clone, removeColors } from '../../utils';

export default class MapsWindow extends ListWindow {
    params: string[] = [];
    template: string = "core/plugins/maps/maplist.twig"
    pageSize = 20;
    ranks: { [key: string]: { mapUid: string, rank: number }[] } = {};

    constructor(login: string, params: string[]) {
        super(login);
        this.params = params;
    }

    async uiPaginate(login: string, answer: any, entries: any): Promise<void> {
        let maps: any[] = [];
        let i = 1;
        let serverMaps = clone(tmc.maps.get());
        await this.getPersonalRank(login, serverMaps.map((map: Map) => map.UId));
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
                        Rank: this.ranks[login].find((rank) => rank.mapUid == map.UId)?.rank || 99999
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

    async getPersonalRank(login: string, mapUids: string[]) {
        const mmmPoints = await MMMPoints.findAll({
            where: {
                login: login,
                mapUid: {
                    [Op.in]: mapUids
                }
            }
        });

        this.ranks[login] = mmmPoints.map((point) => {
            return {
                mapUid: point.mapUid as string,
                rank: point.rank as number
            };
        });
    }
}