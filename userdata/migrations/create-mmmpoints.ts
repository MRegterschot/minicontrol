import { DataTypes } from 'sequelize';
import type { Migration } from '../../migrate';

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().createTable('mmmpoints', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        login: {
            type: DataTypes.STRING,
            allowNull: false,
        },
		mapUid: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		rank: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		time: {
			type: DataTypes.INTEGER,
			allowNull: false,
            defaultValue: 0,
		},
		points: {
			type: DataTypes.INTEGER,
			allowNull: false,
            defaultValue: 0,
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
    await sequelize.getQueryInterface().dropTable('mmmpoints');
};