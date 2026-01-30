'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Nation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.City, { foreignKey: 'nationId' });
    }
  }
  Nation.init({
    name: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Nation',
  });
  return Nation;
};