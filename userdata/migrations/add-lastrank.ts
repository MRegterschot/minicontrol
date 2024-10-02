import { DataTypes } from "sequelize";
import type { Migration } from "../../migrate";

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().addColumn("players", "lastRank", {
        type: DataTypes.INTEGER,
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().removeColumn("players", "lastRank");
};
