import { DataTypes } from "sequelize";
import type { Migration } from "../../migrate";

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().addColumn("mmmrank", "rankName", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Beginner",
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().removeColumn("mmmrank", "rankName");
};
