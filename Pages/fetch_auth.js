async function fetchProducts(accessToken) {
    try {
        const response = await fetch("http://localhost:5000/fetch-products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const result = await response.json();
        let productIds = result.results?.searchresults?.map(product => product.id) || [];

        if (productIds.length > 0) {
            await fetchProductInfo(accessToken, productIds);
        }
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

async function fetchProductInfo(accessToken, productIds) {
    try {
        const response = await fetch("http://localhost:5000/fetch-product-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken, productIds })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const productData = await response.json();
        const validProducts = productData.filter(p => p.centre && p.footprint && p.footprint.coordinates && !p.error);

        if (validProducts.length === 0) {
            console.warn("⚠️ No valid locations found.");
            return;
        }

        const markers = validProducts.map(({ productId, centre, footprint }) => {
            const [lat, lng] = centre.split(',').map(Number);
            const coordinates = footprint.coordinates[0].map(coord => [coord[1], coord[0]]); 
            return { lat, lng, productId, coordinates };
        });

        addMarkersToMap(markers);

    } catch (error) {
        console.error("Error fetching product info:", error);
    }
}

// Mission stuffs

const renderMissionCards = (missions) => {
    const container = document.getElementById("mission-list");
    if (!container) return;
  
    container.innerHTML = missions.map(m => `
      <div class="mission-card" onclick="location.href='#';" style="cursor: pointer;">
        <h3>${m.name}</h3>
        <p>mission-start:  [example] </p> <p>mission-end:  [example]</p>
      </div>
    `).join('');
  };


async function fetchMissionInfo(accessToken) {
    const loadingMessage = document.getElementById("loading-message");
    try {
        // Show loading message
        if (loadingMessage) {
            loadingMessage.style.display = "block";
        }
        const response = await fetch("http://localhost:5000/fetch-missions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const missionData = await response.json();
        renderMissionCards(missionData.missions);
    } catch (error) {
        console.error("Error fetching mission info:", error);
    }
}


// End of Mission Stuffs


async function fetchAccessToken() {
    const urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", "password");
    urlencoded.append("username", "hallam2");
    urlencoded.append("password", "2513@5De");

    try {
        const response = await fetch("https://hallam.sci-toolset.com/api/v1/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic c2NpLXRvb2xzZXQ6c3Q="
            },
            body: urlencoded
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const result = await response.json();
        if (result.access_token) {
            await fetchProducts(result.access_token);
            await fetchMissionInfo(result.access_token);

        }
    } catch (error) {
        console.error("Token fetch error:", error);
    }
}

fetchAccessToken();
