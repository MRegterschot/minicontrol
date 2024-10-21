import { DataTypes } from "sequelize";
import type { Migration } from "../../migrate";

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().addColumn("players", "introSkipped", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().removeColumn("players", "introSkipped");
};
