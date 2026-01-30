'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TransportMean extends Model {
    getLocation() {
      if (this.locationType === 'TrainStation') return this.getTrainStation();
      if (this.locationType === 'Airport') return this.getAirport();
      if (this.locationType === 'Port') return this.getPort();
      if (this.locationType === 'Destination') return this.getDestination();
      return null;
    }

    getCapacity() { return this.capacity; }
    getLoad() { return this.load; }
    getLoadType() { return this.loadType; }
    setLoadType(type) { this.loadType = type; }

    async load(quantity) {
      if (this.load + quantity <= this.capacity) {
        this.load += quantity;
        await this.save();
      } else {
        throw new Error('Capacity exceeded');
      }
    }

    async unload(quantity) {
      if (this.load - quantity >= 0) {
        this.load -= quantity;
        await this.save();
      } else {
        throw new Error('Insufficient load');
      }
    }

    async moveTo(place, placeType) {
      this.locationId = place.id;
      this.locationType = placeType;
      await this.save();
    }
    static associate(models) {
      this.belongsTo(models.TrainStation, {
        foreignKey: 'locationId',
        constraints: false,
        as: 'trainStation'
      });
      this.belongsTo(models.Airport, {
        foreignKey: 'locationId',
        constraints: false,
        as: 'airport'
      });
      this.belongsTo(models.Port, {
        foreignKey: 'locationId',
        constraints: false,
        as: 'port'
      });
      this.belongsTo(models.Destination, {
        foreignKey: 'locationId',
        constraints: false,
        as: 'destination'
      });
    }
  }
  TransportMean.init({
    capacity: DataTypes.INTEGER,
    load: DataTypes.INTEGER,
    loadType: DataTypes.ENUM('PACKAGE', 'STANDARD', 'WIDE_LOAD', 'EMPTY'),
    type: DataTypes.STRING,
    locationId: DataTypes.INTEGER,
    locationType: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'TransportMean',
  });
  return TransportMean;
};