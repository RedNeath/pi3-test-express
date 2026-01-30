'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TrainStation extends Model {
    getStoredQuantity(type) {
      if (type) {
        return this.storage[type] || 0;
      }
      return Object.values(this.storage).reduce((a, b) => a + b, 0);
    }

    async pickUp(type, quantity, options = {}) {
      if (this.storage[type] >= quantity) {
        this.storage[type] -= quantity;
        this.changed('storage', true);
        await this.save(options);
      } else {
        throw new Error('Insufficient storage');
      }
    }

    getStreet() { return this.street; }
    getCity() { return this.city; }
    getNation() { return this.city ? this.city.nation : null; }
    async deliver(type, quantity, options = {}) {
      if (!this.storage[type]) this.storage[type] = 0;
      this.storage[type] += quantity;
      this.changed('storage', true);
      await this.save(options);
    }
    static associate(models) {
      this.belongsTo(models.City, { foreignKey: 'cityId', as: 'city' });
      this.hasMany(models.TransportMean, {
        foreignKey: 'locationId',
        constraints: false,
        scope: {
          locationType: 'TrainStation'
        },
        as: 'transportMeans'
      });
    }
  }
  TrainStation.init({
    street: DataTypes.STRING,
    storage: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'TrainStation',
  });
  return TrainStation;
};