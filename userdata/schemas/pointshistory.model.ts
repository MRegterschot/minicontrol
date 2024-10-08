import { Table, Column, Model, PrimaryKey, DataType, NotNull, AllowNull, HasOne } from "sequelize-typescript";
import Player from "../../core/schemas/players.model";

@Table({ tableName: "pointshistory", timestamps: true })
class PointsHistory extends Model {
    @PrimaryKey
    @Column(DataType.INTEGER)
    id: number | undefined;

    @NotNull
    @AllowNull(false)
    @Column(DataType.STRING)
    @HasOne(() => Player, { as: "player", sourceKey: "login", foreignKey: "login" })
    login: string | undefined;

    @Column(DataType.STRING)
    mapUid: string | undefined;

    @Column(DataType.INTEGER)
    time!: number;

    @Column(DataType.INTEGER)
    rank!: number | null;

    @Column(DataType.INTEGER)
    points!: number;
}

export default PointsHistory;
