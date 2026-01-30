'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Destination extends Model {
    getStreet() { return this.street; }
    getCity() { return this.city; }
    getNation() { return this.city ? this.city.nation : null; }
    async deliver(type, quantity, options = {}) {
      // Logic for delivery to a final destination (e.g., logging or updating a delivery record)
      console.log(`Delivered ${quantity} of ${type} to ${this.street}`);
    }
    static associate(models) {
      this.belongsTo(models.City, { foreignKey: 'cityId', as: 'city' });
      this.hasMany(models.TransportMean, {
        foreignKey: 'locationId',
        constraints: false,
        scope: {
          locationType: 'Destination'
        },
        as: 'transportMeans'
      });
    }
  }
  Destination.init({
    street: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Destination',
  });
  return Destination;
};