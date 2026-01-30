'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TransportMeans', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      capacity: {
        type: Sequelize.INTEGER
      },
      load: {
        type: Sequelize.INTEGER
      },
      loadType: {
        type: Sequelize.ENUM('PACKAGE', 'STANDARD', 'WIDE_LOAD', 'EMPTY')
      },
      type: {
        type: Sequelize.STRING
      },
      locationId: {
        type: Sequelize.INTEGER
      },
      locationType: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TransportMeans');
  }
};