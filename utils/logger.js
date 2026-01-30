const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => {
      let message = `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`;
      if (info.details) {
        const { fromCity, toCity, loadType, quantity } = info.details;
        message += ` | De: ${fromCity} À: ${toCity} | Chargement: ${loadType} | Quantité: ${quantity}`;
      }
      return message;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(__dirname, '../logs/transport.log') })
  ],
});

module.exports = logger;
