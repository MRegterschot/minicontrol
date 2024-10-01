import Player from "@core/schemas/players.model";
import { Table, Column, Model, PrimaryKey, DataType, AllowNull, NotNull, HasOne } from "sequelize-typescript";

@Table({ tableName: "onlineplayers", timestamps: true })
class OnlinePlayers extends Model {
    @PrimaryKey
    @Column(DataType.INTEGER)
    id: number | undefined;

    @NotNull
    @AllowNull(false)
    @Column(DataType.STRING)
    @HasOne(() => Player, { as: "player", sourceKey: "login", foreignKey: "login" })
    login!: string;
}

export default OnlinePlayers;
