const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the Pages, CSS, Scripts, and data folders
app.use(express.static('C:/Users/sigam/Documents/Application/Pages'));   // Serving HTML files from Pages folder
app.use('/css', express.static('C:/Users/sigam/Documents/Application/CSS'));  // Serving CSS files from CSS folder
app.use('/scripts', express.static('C:/Users/sigam/Documents/Application/Scripts'));  // Serving JS files from Scripts folder
app.use('/data', express.static('C:/Users/sigam/Documents/Application/data'));  // Serving data folder (GeoJSON)

// Route to fetch products

app.get("/", (req, res) => {
    res.send("Backend is live!");
  });
  
app.post('/fetch-products', async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    try {
        const response = await axios.post(
            'https://hallam.sci-toolset.com/discover/api/v1/products/search',
            { size: 150, keywords: '' },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products', details: error.message });
    }
});

// Route to fetch product info
app.post('/fetch-product-info', async (req, res) => {
    const { accessToken, productIds } = req.body;

    if (!accessToken || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "Invalid request parameters" });
    }

    try {
        const productRequests = productIds.map(productId =>
            axios.get(`https://hallam.sci-toolset.com/discover/api/v1/products/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }).then(response => ({
                productId,
                centre: response.data.product?.result?.centre || null,
                footprint: response.data.product?.result?.footprint || null
            })).catch(error => ({
                productId,
                error: error.response?.data || "Failed to fetch"
            }))
        );

        const results = await Promise.all(productRequests);
        res.json(results);

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch product info", details: error.message });
    }
});

// Mission Stuffs
app.post('/fetch-missions', async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    try {
        const response = await axios.get(
            'https://hallam.sci-toolset.com/discover/api/v1/missionfeed/missions',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                params: { size: 25, keywords: '' },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch mission data', details: error.message });
    }
});

// End of Mission Stuffs


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend API running on http://localhost:${PORT}`));
