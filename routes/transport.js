const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');

router.post('/transport-requests', transportController.createTransportRequest);
router.get('/places', transportController.getPlaces);

module.exports = router;
