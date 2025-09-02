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
}

module.exports = new ScrapController();