(function () {
    function edgeFunctionUrl() {
        const config = window.SKYE_SUPABASE || {};
        if (config.contactFunctionUrl) return config.contactFunctionUrl;
        if (!config.url) return '';
        return config.url.replace('.supabase.co', '.functions.supabase.co') + '/submit-contact-form';
    }

    function setStatus(status, message, type) {
        status.textContent = message;
        status.className = type ? `contact-status ${type}` : 'contact-status';
    }

    function init(form) {
        if (!form || form.dataset.contactReady === 'true') return;

        const status = form.querySelector('.contact-status');
        const submitButton = form.querySelector('.contact-submit');
        if (!status || !submitButton) return;

        form.dataset.contactReady = 'true';

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const config = window.SKYE_SUPABASE || {};
            const endpoint = edgeFunctionUrl();
            const data = new FormData(form);

            if (!endpoint || !config.anonKey) {
                setStatus(status, 'Contact form setup is missing. Please try again later.', 'error');
                return;
            }

            const originalMessage = String(data.get('message') || '');
            const payload = {
                firstName: String(data.get('firstName') || ''),
                lastName: String(data.get('lastName') || ''),
                email: String(data.get('email') || ''),
                phone: String(data.get('phone') || ''),
                message: originalMessage,
                captchaConfirmed: data.get('captchaConfirmed') === 'on',
                marketingConsent: true,
                contactConsent: true,
                sourcePage: window.location.href,
                listingSlug: form.dataset.listingSlug || '',
                propertyAddress: form.dataset.propertyAddress || '',
                honeypot: String(data.get('website') || '')
            };

            setStatus(status, '', '');
            submitButton.disabled = true;

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        apikey: config.anonKey,
                        Authorization: `Bearer ${config.anonKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.ok === false) {
                    throw new Error(result.error || 'Unable to send your message right now.');
                }

                form.reset();
                form.querySelector('[name="message"]').value = originalMessage;
                setStatus(status, 'Thank you. Your message has been sent to the listing agent.', 'success');
            } catch (error) {
                setStatus(status, error.message || 'Unable to send your message right now.', 'error');
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    window.SkyeContactForm = { init };
})();
