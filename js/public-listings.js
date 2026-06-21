function primaryPhoto(listing) {
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    return photos.find(photo => photo.is_primary) || photos[0];
}

function renderListingCard(listing) {
    const photo = primaryPhoto(listing);
    const photoMarkup = photo
        ? `<img src="${photo.url}" alt="${photo.alt_text}">`
        : `<div class="listing-photo-placeholder">SKYE</div>`;

    return `
        <article class="listing-card">
            <a href="property.html?slug=${encodeURIComponent(listing.slug)}" class="listing-photo">
                ${photoMarkup}
            </a>
            <div class="listing-card-body">
                <p class="listing-price">${SkyeListings.formatMoney(listing.price)}</p>
                <h3>${listing.title}</h3>
                <p class="listing-address">${SkyeListings.displayAddress(listing)}</p>
                <div class="listing-stats">
                    <span>${listing.bedrooms} Beds</span>
                    <span>${listing.bathrooms} Baths</span>
                    <span>${Number(listing.interior_sq_ft).toLocaleString()} Sq Ft</span>
                </div>
                <p class="listing-mls">MLS # ${listing.mls_number}</p>
                <a href="property.html?slug=${encodeURIComponent(listing.slug)}" class="listing-card-link">View Property</a>
            </div>
        </article>
    `;
}

async function loadListingGrid(status) {
    const grid = document.getElementById('listingGrid');
    const empty = document.getElementById('emptyListings');
    const pagination = document.getElementById('listingPagination');
    const page = Number(new URLSearchParams(window.location.search).get('page') || 1);

    if (!grid) return;

    const result = await SkyeListings.getPublicListings(status, page);

    if (!result.configured) {
        grid.innerHTML = '';
        empty.hidden = false;
        empty.querySelector('h2').textContent = 'Supabase setup needed';
        empty.querySelector('p').textContent = 'Add your Supabase project URL and anon key to js/supabase-config.js to load live listings.';
        return;
    }

    if (result.error) {
        grid.innerHTML = '';
        empty.hidden = false;
        empty.querySelector('h2').textContent = 'Listings could not load';
        empty.querySelector('p').textContent = result.error.message;
        return;
    }

    if (!result.data.length) {
        grid.innerHTML = '';
        empty.hidden = false;
        return;
    }

    empty.hidden = true;
    grid.innerHTML = result.data.map(renderListingCard).join('');

    const perPage = window.SKYE_SUPABASE.listingsPerPage || 10;
    const pageCount = Math.ceil(result.count / perPage);
    if (pageCount > 1 && pagination) {
        pagination.innerHTML = Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            const active = pageNumber === page ? ' active' : '';
            return `<a class="page-link${active}" href="?page=${pageNumber}">${pageNumber}</a>`;
        }).join('');
    }
}

async function loadPropertyDetail() {
    const root = document.getElementById('propertyDetail');
    if (!root) return;

    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) {
        root.innerHTML = '<div class="listing-panel"><h2>Property not found</h2><p>No property slug was provided.</p></div>';
        return;
    }

    const result = await SkyeListings.getListingBySlug(slug);
    if (!result.configured) {
        root.innerHTML = '<div class="listing-panel"><h2>Supabase setup needed</h2><p>Add your Supabase project URL and anon key to js/supabase-config.js to load property details.</p></div>';
        return;
    }

    if (result.error || !result.data) {
        root.innerHTML = '<div class="listing-panel"><h2>Property not found</h2><p>This listing is not currently available.</p></div>';
        return;
    }

    const listing = result.data;
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    const gallery = photos.length
        ? photos.map(photo => `<img src="${photo.url}" alt="${photo.alt_text}">`).join('')
        : '<div class="listing-photo-placeholder large">SKYE</div>';

    root.innerHTML = `
        <div class="property-gallery">${gallery}</div>
        <div class="property-layout">
            <main>
                <p class="listing-price">${SkyeListings.formatMoney(listing.price)}</p>
                <h1>${listing.title}</h1>
                <p class="listing-address">${SkyeListings.displayAddress(listing)}</p>
                <div class="listing-stats detail-stats">
                    <span>${listing.bedrooms} Beds</span>
                    <span>${listing.bathrooms} Baths</span>
                    <span>${Number(listing.interior_sq_ft).toLocaleString()} Sq Ft</span>
                    <span>${listing.lot_size} Lot</span>
                </div>
                <p class="property-description">${listing.description}</p>
                <p class="listing-mls">MLS # ${listing.mls_number}</p>
                <a href="${listing.zillow_url}" target="_blank" rel="noopener noreferrer" class="listing-cta">View full Zillow listing for complete property details</a>
            </main>
            <aside class="agent-panel">
                <p class="section-label">Listing Agent</p>
                <h2>${listing.agent_name}</h2>
                <a href="tel:${listing.agent_office_phone}">Office: ${listing.agent_office_phone}</a>
                <a href="tel:${listing.agent_mobile_phone}">Mobile: ${listing.agent_mobile_phone}</a>
                <a href="mailto:${listing.agent_email}">${listing.agent_email}</a>
            </aside>
        </div>
    `;
}
