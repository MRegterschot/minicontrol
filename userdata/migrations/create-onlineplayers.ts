import { DataTypes } from "sequelize";
import type { Migration } from "../../migrate";

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().createTable("onlineplayers", {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        login: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
        },
        createdAt: {
            type: DataTypes.DATE,
        },
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().dropTable("onlineplayers");
};
