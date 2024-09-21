import { Table, Column, Model, PrimaryKey, DataType, NotNull, AllowNull, HasOne, Default } from "sequelize-typescript";
import Player from "../../core/schemas/players.model";

@Table({ tableName: "mmmrank", timestamps: true })
class MMMRank extends Model {
    @PrimaryKey
    @Column(DataType.INTEGER)
    id: number | undefined;

    @NotNull
    @AllowNull(false)
    @Column(DataType.STRING)
    @HasOne(() => Player, { as: "player", sourceKey: "login", foreignKey: "login" })
    login: string | undefined;

    @Column(DataType.INTEGER)
    rank!: number | null;

    @Column(DataType.INTEGER)
    totalPoints!: number;

    @NotNull
    @AllowNull(false)
    @Column(DataType.STRING)
    rankName!: string;
}

export default MMMRank;
