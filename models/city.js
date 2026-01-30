'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class City extends Model {
    getName() { return this.name; }
    getPostcode() { return this.postcode; }
    getNation() { return this.nation; }
    static associate(models) {
      this.belongsTo(models.Nation, { foreignKey: 'nationId', as: 'nation' });
      this.hasMany(models.TrainStation, { foreignKey: 'cityId', as: 'trainStations' });
      this.hasMany(models.Destination, { foreignKey: 'cityId', as: 'destinations' });
      this.belongsToMany(models.Airport, { through: 'AirportCities', foreignKey: 'cityId', as: 'airports' });
      this.belongsToMany(models.Port, { through: 'PortCities', foreignKey: 'cityId', as: 'ports' });
    }
  }
  City.init({
    name: DataTypes.STRING,
    postcode: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'City',
  });
  return City;
};