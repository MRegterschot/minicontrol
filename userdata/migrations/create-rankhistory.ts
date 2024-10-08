import { DataTypes } from 'sequelize';
import type { Migration } from '../../migrate';

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().createTable('rankhistory', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        login: {
            type: DataTypes.STRING,
            allowNull: false,
        },
		rank: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		totalPoints: {
			type: DataTypes.INTEGER,
			allowNull: false,
            defaultValue: 0,
		},
        rankName: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "Beginner",
        },
        updatedAt: {
            type: DataTypes.DATE
        },
        createdAt:
        {
            type: DataTypes.DATE
		}
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().dropTable('rankhistory');
};