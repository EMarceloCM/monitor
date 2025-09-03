const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/HomeController');
const ScrapController = require('../controllers/ScrapController');

router.get('/', HomeController.index);
router.get('/page', HomeController.filteredIndex);
router.get('/filtered', HomeController.filteredIndex);
router.get('/scrap', ScrapController.scrap);
router.get('/export/csv', ScrapController.exportToCSV);
router.get('/export/excel', ScrapController.exportToExcel);
router.get('/stats', ScrapController.stats);

module.exports = router;