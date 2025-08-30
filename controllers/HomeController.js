const ScrapRepository = require('../repositories/ScrapRepository');

class HomeController {
    async index(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const result = await ScrapRepository.findAllWithPagination(page, limit);

        if (result.error)
            return res.render('index', { scraps: [], error: result.error });

        const totalPages = Math.ceil(result.total / limit);

        res.render('index', { 
            scraps: result.scraps, 
            error: null,
            currentPage: page,
            totalPages,
            registriesCount: result.total,
            filters: {
                platform: '',
                city: '',
                state: '',
                date: ''
            }
        });
    }

    async filteredIndex(req, res) {
        const { platform, city, state, date } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const filters = { platform, city, state, date };

        const result = await ScrapRepository.findByFilters(filters, page, limit);
        if (result.error)
            return res.render('index', { scraps: [], error: result.error });

        const totalPages = Math.ceil(result.total / limit);
        
        res.render('index', { 
            scraps: result.scraps, 
            error: null,
            currentPage: page,
            totalPages,
            registriesCount: result.total,
            filters
        });
    }
}

module.exports = new HomeController();