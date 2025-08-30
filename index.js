const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const router = require('./routes/routes');

const multer = require('multer');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const dayjs = require('dayjs');
const { filter, uniq } = require('lodash');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const ScrapController = require('./controllers/ScrapController');
const e = require('express');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/', router);

let percentage = 0;

app.post('/scrapeifood', upload.single('file'), async (req, res) => {
    console.log("Iniciando scraping do iFood...");
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded' });

    const fileContent = req.file.buffer.toString("utf-8");
    const $ = cheerio.load(fileContent);
    const links = [];

    $(".merchant-v2__link").each((_, elm) => {
        const link = $(elm).attr("href");
        if (link) {
            links.push(link.startsWith("http") ? link : `https://www.ifood.com.br${link}`);
        }
    });

    console.log("Total de links encontrados:", links.length);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
            "--max-old-space-size=8192",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-extensions",
            ],
        });
    } catch (error) {
        console.error("Failed to start browser: ", error.message);
        return res.status(500).json({ error: 'Failed to start browser' });
    }

    const scrapedData = [];
    const totalLinks = links.length;
    let processed = 0;

    for (const link of links) {
        let page;
        try {
            page = await browser.newPage();
            // networkidle2 aguarda a página carregar por completo
            await page.goto(link, { waitUntil: "networkidle2" });
            await page.waitForSelector(".merchant-info__title");

            const name = await page.$eval(".merchant-info__title", (el) =>
                el.textContent.trim()
            );
            let reviews = "0";
            let last_review = "Não disponível";

            try {
                await page.click(".restaurant-rating__rating-wrapper > a > button");
                await page.waitForSelector(".drawer__content-container", {
                    visible: true,
                });
            } catch (e) {
                console.warn(`\nNão foi possível abrir o painel de avaliações para ${link}:`, e.message);
            }

            try {
                reviews = await page.$eval("h3.rating-counter__total", (el) =>
                    el.textContent.replace(" avaliações no total", "").trim()
                );
            } catch (e) {
                console.warn(`\nNão encontrou o seletor h3.rating-counter__total para ${link}`);
            }

            try {
                const dates = await page.$$eval(
                    ".rating-evaluation-header__date",
                    (elements) => elements.map((el) => el.textContent.trim())
                );
                const datasValidas = dates.filter(d => d !== "Não disponível");

                if (datasValidas.length) {
                    last_review = datasValidas.sort(
                        (a, b) => dayjs(b, "DD/MM/YYYY").valueOf() - dayjs(a, "DD/MM/YYYY").valueOf()
                    )[0];
                }
            } catch (e) {
                console.warn(`\nNão encontrou datas com seletor .rating-evaluation-header__date para ${link}`);
            }

            scrapedData.push({ name, link, reviews, last_review });
            
            const match = link.match(/\/delivery\/([a-zA-Z-]+)-([a-zA-Z]{2})\//);
            const city = match ? match[1].replace(/-/g, ' ') : "Unknown";
            const state = match ? match[2].toUpperCase() : "Unknown";
            const last_reviewValue = last_review !== "Não disponível" ? last_review.split('/') : null;
            const last_reviewFormatted = (last_reviewValue != null && last_reviewValue.length === 3) ? `${last_reviewValue[2]}/${last_reviewValue[1]}/${last_reviewValue[0]}` : null;
            
            ScrapController.create({
                body: {
                    establishment: name,
                    city: city,
                    state: state,
                    platform: "ifood",
                    link: link,
                    reviews: reviews === "0" ? 0 : parseInt(reviews),
                    last_review: last_reviewFormatted
                }
            }, {
                status: (code) => ({
                    json: (data) => console.log(`Response status: ${code}`, data)
                })
            });
            console.log(`\nDados extraídos de ${link}:`, { name, link, reviews, last_review });
        } catch (error) {
            console.error(`\nErro ao processar ${link}:`, error.message);
        } finally {
            processed++;
            percentage = Math.round((processed / totalLinks) * 100);
            console.log(`Progresso: ${percentage}%`);
            
            if (page) await page.close();
        }
    }

    await browser.close();
    percentage = 100;
    res.json({ success: true, data: scrapedData });
});

app.post("/scrapeaiqfome", async (req, res) => {
    const { city, state } = req.body;

    if (!city || !state)
        return res.status(400).json({ error: "Both city and state are required" });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`https://aiqfome.com/restaurantes/${city}-${state}`);

    let links = await page.evaluate(() => {
        const list = [];
        document.querySelectorAll("a").forEach((link) => {
            list.push(link.getAttribute("href"));
        });
        return list;
    });

    links = uniq(links);
    console.log("Total de links:", links.length);

    const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    let scrapedData = [];

    let pagePromise = (link) => new Promise(async (resolve) => {
        let establishment = {
            name: null,
            link: link,
            reviews: null,
            last_review: null,
        };

        let newPage = await browser.newPage();
        await newPage.goto(link, { waitUntil: "networkidle2" });

        try {
            await newPage.waitForSelector("#nome-restaurante-fix", { visible: true, });
            establishment["name"] = await newPage.$eval(
                "#nome-restaurante-fix",
                (text) => text.textContent.trim()
            );
        } catch (e) {
            establishment["name"] = "Name not found";
        }

        try {
            const anchors = await newPage.evaluate(() => {
                const list = [];
                document.querySelectorAll("a").forEach((link) => {
                    if (link.getAttribute("data-target") === "#modalAvaliacoes") {
                        link.click();
                        list.push(link);
                    }
                });
                return list;
            });

            if (anchors.length) {
                await newPage.waitForSelector("#modalAvaliacoes", { visible: true });
                await delay(10000);
                establishment["reviews"] = await newPage.$eval(
                    "#avaliacoes_conteudo > div > div > div > h3",
                    (text) => text.textContent.replace(" avaliações", "").trim()
                );

                try {
                    establishment["last_review"] = await newPage.$eval(
                        "span.small-font.font-main.dark-purple-text",
                        (text) => text.textContent.trim()
                    );
                } catch (e) {
                    console.warn(`Erro ao capturar última avaliação para ${link}`);
                }
            } else {
                establishment["reviews"] = "Without reviews";
            }
        } catch (e) {
            establishment["reviews"] = "Error fetching reviews";
        }

        resolve(establishment);
        if (newPage)
            await newPage.close();
        else
            console.warn("newPage was lost");
    });

    links = filter(links, (o) => o && o.match(`/${state}/${city}`));

    for (let i in links) {
        const url = `https://aiqfome.com${links[i]}`;
        console.log("url:", url);
        percentage = Math.round((i / links.length) * 100, 2);
        console.log("progress: ", `${percentage}%`);
        let currentPageData = await pagePromise(url);
        console.log(currentPageData);
        scrapedData.push(currentPageData);

        const last_reviewValue = currentPageData.last_review ? currentPageData.last_review.split('/') : null;
        const last_reviewFormatted = (last_reviewValue != null && last_reviewValue.length === 3) ? `${last_reviewValue[2]}/${last_reviewValue[1]}/${last_reviewValue[0]}` : null;
        ScrapController.create({
            body: {
                establishment: currentPageData.name,
                city,
                state,
                platform: "aiqfome",
                link: currentPageData.link,
                reviews: currentPageData.reviews === "Without reviews" ? 0 : currentPageData.reviews,
                last_review: last_reviewFormatted
            }
        }, {
            status: (code) => ({
                json: (data) => console.log(`Response status: ${code}`, data)
            })
        });
    }

    await browser.close();
    percentage = 100;
    res.json({ success: true, data: scrapedData });
});

const server = app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

const io = require('socket.io')(server);

io.on('connection', (socket) => {
    console.log('New client connected');

    let timer = null;

    const sendProgress = () => {
        socket.emit('progress', { percentage });
        if (percentage < 100) {
            timer = setTimeout(sendProgress, 1000);
        } else {
            clearTimeout(timer);
            timer = null;
            console.log('Scraping completed, progress reached 100%');
        }
    };
    
    socket.on('startProgress', () => {
        if (!timer) {
            percentage = 0;
            sendProgress();
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});