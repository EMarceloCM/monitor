const ScrapRepository = require('../repositories/ScrapRepository');

class ScrapController {
    async scrap(req, res) {
        res.render('scrap');
    }

    async create(req, res) {
        const { establishment, city, state, platform, link, reviews, last_review } = req.body;

        if (!establishment || !city || !state || !platform || !link || !reviews)
            return res.status(400).json({ error: "Name, city, state, platform, link and reviews are required" });

        const newScrap = await ScrapRepository.create(establishment, city, state, platform, link, reviews, last_review);
        if (newScrap.error) {
            return res.status(500).json({ error: newScrap.error });
        }
        res.status(201).json(newScrap);
    }

    async exportToCSV(req, res) {
        const { city, state, platform, date } = req.query;
        const filters = { city, state, platform, date };
        const csvData = await ScrapRepository.exportToCSV(filters);
        
        if (csvData.error) {
            return res.status(500).json({ error: csvData.error });
        }
        
        res.header('Content-Type', 'text/csv');
        res.attachment('scraps.csv');
        return res.send(csvData);
    }

    async exportToExcel(req, res) {
        const { city, state, platform, date } = req.query;
        const filters = { city, state, platform, date };
        const excelData = await ScrapRepository.exportToExcel(filters);
        if (excelData.error) {
            return res.status(500).json({ error: excelData.error });
        }
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('scraps.xlsx');
        return res.send(excelData);
    }

    async stats(req, res) {
        try {
            const stats = await ScrapRepository.getStats();

            res.render('stats', {
                platformStats: stats.platformStats,
                kpis: stats.kpis,
                lastUpdated: stats.lastUpdated,
                topByReviews: stats.topByReviews,
                topByGrowth: stats.topByGrowth,
                topCities: stats.topCities
            });
        } catch (error) {
            console.error('Error rendering stats page: ', error);
            res.status(500).send('Error rendering stats page');
        }
    }
}

module.exports = new ScrapController();