const AdminApp = (() => {
    const client = SkyeListings.client;
    const maxListingPhotos = 4;

    function setupWarning() {
        if (SkyeListings.isConfigured) return '';
        return `<div class="message error">Supabase is not configured yet. Add your Project URL and anon key to <strong>js/supabase-config.js</strong>.</div>`;
    }

    async function login(email, password) {
        if (!client) throw new Error('Supabase is not configured.');
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'dashboard.html';
    }

    async function logout() {
        if (client) await client.auth.signOut();
        window.location.href = 'login.html';
    }

    async function resetPassword(email) {
        if (!client) throw new Error('Supabase is not configured.');
        const redirectTo = `${window.location.origin}${window.location.pathname.replace('/admin/login.html', '/admin/set-password.html')}`;
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
    }

    async function setPassword(password) {
        if (!client) throw new Error('Supabase is not configured.');
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) {
            throw new Error('This invite link is missing or expired. Please ask the admin to send a new invitation.');
        }

        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
    }

    async function loadDashboard() {
        const root = document.getElementById('dashboardListings');
        if (!root) return;
        root.insertAdjacentHTML('beforebegin', setupWarning());
        if (!client) return;

        await SkyeListings.requireSession();
        const { data, error } = await client
            .from('listings')
            .select('id,title,status,price,mls_number,updated_at,created_by')
            .order('updated_at', { ascending: false });

        if (error) {
            root.innerHTML = `<div class="message error">${error.message}</div>`;
            return;
        }

        if (!data.length) {
            root.innerHTML = '<div class="panel"><h2>No Listings Yet</h2><p class="help">Create the first listing to start the approval workflow.</p></div>';
            return;
        }

        root.innerHTML = `
            <table class="listing-table">
                <thead><tr><th>Listing</th><th>Status</th><th>Price</th><th>MLS</th><th></th></tr></thead>
                <tbody>
                    ${data.map(listing => `
                        <tr>
                            <td>${listing.title}</td>
                            <td><span class="status-pill">${SkyeListings.statusLabels[listing.status] || listing.status}</span></td>
                            <td>${SkyeListings.formatMoney(listing.price)}</td>
                            <td>${listing.mls_number || ''}</td>
                            <td><a class="btn secondary" href="listing-editor.html?id=${listing.id}">Edit</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function formDataToListing(form) {
        const data = Object.fromEntries(new FormData(form).entries());
        const slugBase = data.hide_address === 'on'
            ? `${data.title}-${data.city}-${data.state}`
            : `${data.address}-${data.city}-${data.state}`;
        const price = parsePrice(data.price);

        if (!price || price < 1) {
            throw new Error('Enter a valid price.');
        }

        return {
            title: data.title,
            slug: SkyeListings.slugify(slugBase),
            description: data.description,
            address: data.address,
            city: data.city,
            state: data.state || 'OR',
            zip_code: data.zip_code,
            hide_address: data.hide_address === 'on',
            price,
            bedrooms: Number(data.bedrooms),
            bathrooms: Number(data.bathrooms),
            interior_sq_ft: Number(data.interior_sq_ft),
            lot_size: data.lot_size,
            mls_number: data.mls_number,
            zillow_url: data.zillow_url,
            agent_name: data.agent_name,
            agent_office_phone: data.agent_office_phone,
            agent_mobile_phone: data.agent_mobile_phone,
            agent_email: data.agent_email,
            autosaved_at: new Date().toISOString()
        };
    }

    function parsePrice(value) {
        const normalized = String(value || '').replace(/[$,\s]/g, '');
        return Math.round(Number(normalized));
    }

    function formatInputPrice(value) {
        if (!value && value !== 0) return '';
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0
        }).format(value);
    }

    async function loadListingForEdit(form) {
        if (!client) return null;
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) return null;

        await SkyeListings.requireSession();
        const { data, error } = await client
            .from('listings')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const fields = [
            'title',
            'description',
            'address',
            'city',
            'state',
            'zip_code',
            'mls_number',
            'bedrooms',
            'bathrooms',
            'interior_sq_ft',
            'lot_size',
            'zillow_url',
            'agent_name',
            'agent_email',
            'agent_office_phone',
            'agent_mobile_phone'
        ];

        fields.forEach(name => {
            if (form.elements[name] && data[name] !== null && data[name] !== undefined) {
                form.elements[name].value = data[name];
            }
        });

        if (form.elements.price) {
            form.elements.price.value = formatInputPrice(data.price);
        }

        if (form.elements.hide_address) {
            form.elements.hide_address.checked = Boolean(data.hide_address);
        }

        const photos = await getListingPhotos(id);
        if (form.elements.photo_alt_text && photos.length) {
            form.elements.photo_alt_text.value = photos[0].alt_text || '';
        }

        return { ...data, photos };
    }

    async function getListingPhotos(listingId) {
        if (!client || !listingId) return [];
        const { data, error } = await client
            .from('listing_photos')
            .select('*')
            .eq('listing_id', listingId)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async function savePhotoAltText(listingId, altText) {
        if (!client || !listingId) return;
        const { error } = await client
            .from('listing_photos')
            .update({ alt_text: altText || 'SKYE Real Estate Group property listing photo' })
            .eq('listing_id', listingId);

        if (error) throw error;
    }

    async function saveListingPhotos(listingId, files, altText) {
        if (!client || !listingId || !files || !files.length) return [];

        const existingPhotos = await getListingPhotos(listingId);
        const remainingSlots = Math.max(0, maxListingPhotos - existingPhotos.length);
        const filesToUpload = Array.from(files).slice(0, remainingSlots);

        if (!filesToUpload.length) {
            throw new Error(`This listing already has the maximum of ${maxListingPhotos} photos.`);
        }

        const uploaded = [];

        for (const [index, file] of filesToUpload.entries()) {
            const sortOrder = existingPhotos.length + index;
            const extension = file.name.split('.').pop() || 'jpg';
            const storagePath = `${listingId}/${Date.now()}-${sortOrder}.${extension}`;
            const { error: uploadError } = await client.storage
                .from('listing-photos')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = client.storage
                .from('listing-photos')
                .getPublicUrl(storagePath);

            const photoRecord = {
                listing_id: listingId,
                storage_path: storagePath,
                public_url: publicUrlData.publicUrl,
                alt_text: altText || 'SKYE Real Estate Group property listing photo',
                sort_order: sortOrder,
                is_primary: existingPhotos.length === 0 && index === 0
            };

            const { data, error } = await client
                .from('listing_photos')
                .insert(photoRecord)
                .select('*')
                .single();

            if (error) throw error;
            uploaded.push(data);
        }

        return uploaded;
    }

    async function saveListing(form, status = 'draft') {
        if (!client) throw new Error('Supabase is not configured.');
        const session = await SkyeListings.requireSession();
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const listing = { ...formDataToListing(form), status };

        if (status === 'pending_approval') listing.submitted_at = new Date().toISOString();

        if (id) {
            const { error } = await client.from('listings').update(listing).eq('id', id);
            if (error) throw error;
            return id;
        }

        const { data, error } = await client
            .from('listings')
            .insert({ ...listing, created_by: session.user.id })
            .select('id')
            .single();
        if (error && error.code === '23505' && String(error.message).includes('listings_slug_key')) {
            const retry = await client
                .from('listings')
                .insert({
                    ...listing,
                    slug: `${listing.slug}-${Date.now().toString(36)}`,
                    created_by: session.user.id
                })
                .select('id')
                .single();
            if (retry.error) throw retry.error;
            return retry.data.id;
        }
        if (error) throw error;
        return data.id;
    }

    async function updateStatus(id, status) {
        if (!client) throw new Error('Supabase is not configured.');
        const timestamp = new Date().toISOString();
        const patch = { status };
        if (status === 'published') patch.published_at = timestamp;
        if (status === 'sold') patch.sold_at = timestamp;
        if (status === 'archived') patch.archived_at = timestamp;
        if (status === 'pending_approval') patch.submitted_at = timestamp;

        const { error } = await client.from('listings').update(patch).eq('id', id);
        if (error) throw error;
    }

    return {
        setupWarning,
        login,
        logout,
        resetPassword,
        setPassword,
        loadDashboard,
        loadListingForEdit,
        getListingPhotos,
        savePhotoAltText,
        saveListingPhotos,
        maxListingPhotos,
        saveListing,
        updateStatus
    };
})();
