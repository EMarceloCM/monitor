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
}

module.exports = new ScrapController();