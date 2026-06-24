const SkyeListings = (() => {
    const config = window.SKYE_SUPABASE || {};
    const isConfigured = config.url && !config.url.includes('PASTE_') && config.anonKey && !config.anonKey.includes('PASTE_');
    const client = isConfigured && window.supabase
        ? window.supabase.createClient(config.url, config.anonKey)
        : null;

    const statusLabels = {
        draft: 'Draft',
        pending_approval: 'Pending Approval',
        needs_edits: 'Needs Edits',
        published: 'Published',
        unpublished: 'Unpublished',
        sold: 'Sold',
        archived: 'Archived - Expired - Unsold'
    };

    function formatMoney(value) {
        if (!value && value !== 0) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value);
    }

    function displayAddress(listing) {
        if (listing.hide_address) return 'Address available upon request';
        return [listing.address, listing.city, listing.state, listing.zip_code].filter(Boolean).join(', ');
    }

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    async function getPublicListings(status, page = 1) {
        if (!client) return { data: [], count: 0, configured: false, error: null };
        const limit = config.listingsPerPage || 10;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await client
            .from('public_listings')
            .select('*', { count: 'exact' })
            .eq('status', status)
            .order(status === 'sold' ? 'sold_at' : 'published_at', { ascending: false, nullsFirst: false })
            .range(from, to);

        return { data: data || [], count: count || 0, configured: true, error };
    }

    async function getListingBySlug(slug) {
        if (!client) return { data: null, configured: false, error: null };
        const { data, error } = await client
            .from('public_listings')
            .select('*')
            .eq('slug', slug)
            .in('status', ['published', 'sold'])
            .single();

        return { data, configured: true, error };
    }

    async function getSession() {
        if (!client) return null;
        const { data } = await client.auth.getSession();
        return data.session;
    }

    async function requireSession() {
        const session = await getSession();
        if (!session) window.location.href = 'login.html';
        return session;
    }

    return {
        client,
        isConfigured,
        statusLabels,
        formatMoney,
        displayAddress,
        slugify,
        getPublicListings,
        getListingBySlug,
        getSession,
        requireSession
    };
})();
