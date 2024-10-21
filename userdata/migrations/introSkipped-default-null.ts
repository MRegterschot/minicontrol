import { DataTypes } from "sequelize";
import type { Migration } from "../../migrate";

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().changeColumn("players", "introSkipped", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().removeColumn("players", "introSkipped");
};
