export class ZendeskMonitor {
    constructor() {
        this.isInitialized = false;
        this.lastCheckTime = 0;
        this.domain = null;
        this.zauth = null;
        this.fetchAllNewTickets = false;
        this.isMonitorActive = true;
    }

    async initialize() {
        try {
            console.log('Initializing ZendeskMonitor');
            const storage = await chrome.storage.local.get(['zauth', 'zendeskDomain', 'isMonitorActive']);

            if (!storage.zendeskDomain) {
                console.error('No Zendesk domain configured');
                return false;
            }

            this.domain = storage.zendeskDomain;

            if (!storage.zauth) {
                console.log('No auth token found');
                return false;
            }

            this.zauth = storage.zauth;
            this.isMonitorActive = storage.isMonitorActive !== false;
            this.isInitialized = true;

            // Ensure offscreen document exists
            await this.ensureOffscreenDocument();

            console.log('ZendeskMonitor initialized successfully');
            return true;
        } catch (error) {
            console.error('Initialization error:', error);
            return false;
        }
    }

    canCheckTickets() {
        return this.isInitialized && this.isMonitorActive;
    }

    async startAuthFlow() {
        console.log('ZendeskMonitor: Starting auth flow');

        const storage = await chrome.storage.local.get(['zendeskDomain']);
        if (!storage.zendeskDomain) {
            console.error('No Zendesk domain configured');
            return;
        }

        const domain = storage.zendeskDomain;
        console.log('Using domain:', domain);

        const clientId = 'zendesk-notifier';
        const redirectUri = 'https://tascott.co.uk/zendesk-extension-oath/index.html';
        const state = Math.random().toString(36).substring(7);

        const authUrl = `https://${domain}.zendesk.com/oauth/authorizations/new?` +
            `response_type=token&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `client_id=${clientId}&` +
            `scope=read&` +
            `state=${state}`;

        console.log('Auth URL:', authUrl);
        console.log('Full auth URL:', authUrl);
        chrome.tabs.create({ url: authUrl });
    }

    async makeZendeskRequest(endpoint) {
        const { zauth } = await chrome.storage.local.get('zauth');

        if (!zauth) {
            throw new Error('No authentication token found');
        }

        const response = await fetch(`https://${this.domain}.zendesk.com/api/v2/${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${zauth}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.isInitialized = false;
                this.startAuthFlow();
                throw new Error('Authentication token expired');
            }
            throw new Error(`API request failed: ${response.status}`);
        }

        return response.json();
    }

    async checkNewTickets() {
        if (!this.canCheckTickets()) {
            console.log('Monitor not active or not initialized, skipping check');
            return;
        }

        try {
            console.log('Checking for tickets...');
            const currentTime = Date.now();

            // Ensure offscreen document is ready
            console.log('Ensuring offscreen document exists...');
            await this.ensureOffscreenDocument();
            console.log('Offscreen document ready');

            // Get check interval from storage and convert to milliseconds
            const storage = await chrome.storage.local.get(['checkInterval']);
            const checkInterval = (parseFloat(storage.checkInterval) || 0.5) * 60 * 1000; // Convert minutes to ms
            const BUFFER_TIME = 2000; // 2 second buffer
            const RECENT_THRESHOLD = checkInterval + BUFFER_TIME;

            const params = new URLSearchParams({
                'sort_by': 'created_at',
                'sort_order': 'desc',
                'include': 'users'
            });

            if (!this.fetchAllNewTickets) {
                params.append('per_page', '10');
            } else {
                params.append('status', 'new');
            }

            const apiUrl = `https://${this.domain}.zendesk.com/api/v2/tickets.json?${params.toString()}`;
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.zauth}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const newStatusTickets = data.tickets.filter(ticket => ticket.status === 'new');

            // Separate tickets by age
            const recentlyCreatedTickets = [];
            const existingNewTickets = [];

            newStatusTickets.forEach(ticket => {
                const ticketAge = currentTime - new Date(ticket.created_at).getTime();
                console.log(`Ticket ${ticket.id} age: ${ticketAge}ms, threshold: ${RECENT_THRESHOLD}ms`);
                if (ticketAge <= RECENT_THRESHOLD) {
                    recentlyCreatedTickets.push(ticket);
                } else {
                    existingNewTickets.push(ticket);
                }
            });

            console.log('Recent tickets:', recentlyCreatedTickets.length);
            console.log('Existing tickets:', existingNewTickets.length);

            console.log('Sound timing check:', {
                currentTime,
                lastCheckTime: this.lastCheckTime,
                timeSinceLastCheck: currentTime - this.lastCheckTime,
                shouldPlaySound: this.lastCheckTime === 0 || currentTime - this.lastCheckTime > 2000
            });

            // Create notifications for all tickets first, newest on top
            for(const ticket of [...recentlyCreatedTickets].reverse()) {
                await this.createNotificationOnly(ticket);
            }
            for(const ticket of [...existingNewTickets].reverse()) {
                await this.createNotificationOnly(ticket);
            }

            // Modified condition to always play on first check, but only once
            if (this.lastCheckTime === 0 || currentTime - this.lastCheckTime > 2000) {
                console.log('Playing sounds for tickets:', {
                    existingCount: existingNewTickets.length,
                    recentCount: recentlyCreatedTickets.length
                });

                // Play only one type of sound based on priority
                if (recentlyCreatedTickets.length > 0) {
                    console.log('Playing sound for recent tickets');
                    await this.playNotificationSound(true);
                } else if (existingNewTickets.length > 0) {
                    console.log('Playing sound for existing tickets');
                    await this.playNotificationSound(false);
                }

                this.lastCheckTime = currentTime;
            } else {
                console.log('Skipping sounds - too soon since last check');
            }

            // Update badge and storage
            chrome.action.setBadgeText({
                text: newStatusTickets.length > 0 ? newStatusTickets.length.toString() : ''
            });
            chrome.action.setBadgeBackgroundColor({ color: '#FF4A1F' });

            await chrome.storage.local.set({
                'recentTickets': data.tickets,
                'lastCheck': new Date().toLocaleString()
            });

        } catch (error) {
            console.error('Error in checkNewTickets:', error);
        }
    }

    async createNotificationOnly(ticket) {
        const notificationId = `ticket-${ticket.id}`;
        console.log(`Creating notification for ticket ${ticket.id}`);

        return new Promise((resolve) => {
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('assets/book.png'),
                title: `New Zendesk Ticket #${ticket.id}`,
                message: ticket.subject || 'No subject',
                requireInteraction: true,
                silent: false
            }, resolve);
        });
    }

    async playNotificationSound(isRecentlyCreated) {
        console.log(`Attempting to play ${isRecentlyCreated ? 'recent' : 'existing'} ticket sound`);
        try {
            return new Promise((resolve) => {
                console.log('Sending PLAY_SOUND message...');
                chrome.runtime.sendMessage({
                    type: 'PLAY_SOUND',
                    isUrgent: isRecentlyCreated
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending play sound message:', chrome.runtime.lastError);
                    } else {
                        console.log('Play sound message sent successfully, response:', response);
                    }
                    resolve();
                });
            });
        } catch (error) {
            console.error('Error playing notification sound:', error);
            throw error;
        }
    }

    async processNewTickets(tickets) {
        for (const ticket of tickets) {
            // Create notification for each new ticket
            const notificationOptions = {
                type: 'basic',
                iconUrl: 'book.png', // Make sure you have this icon in your extension
                title: `New Ticket: ${ticket.subject}`,
                message: `Priority: ${ticket.priority || 'Not set'}\nRequester: ${ticket.requester.name}`,
                buttons: [
                    {
                        title: 'View Ticket'
                    }
                ]
            };

            // Create unique notification ID
            const notificationId = `ticket-${ticket.id}`;

            // Show the notification
            chrome.notifications.create(notificationId, notificationOptions);
        }
    }

    // Helper function to format date for Zendesk API
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().replace('T', ' ').replace('Z', '');
    }

    async ensureOffscreenDocument() {
        try {
            const hasDocument = await chrome.offscreen.hasDocument();
            console.log('Checking offscreen document status:', hasDocument);

            if (!hasDocument) {
                console.log('No offscreen document exists, creating new one...');
                try {
                    await chrome.offscreen.createDocument({
                        url: 'src/offscreen/offscreen.html',
                        reasons: ['AUDIO_PLAYBACK'],
                        justification: 'Playing notification sound'
                    });
                    console.log('Offscreen document created successfully');

                    // Add a small delay to ensure document is ready
                    await new Promise(resolve => setTimeout(resolve, 500));
                    console.log('Offscreen document initialization complete');
                } catch (createError) {
                    // If we get an error about existing document, just log it and continue
                    if (createError.message.includes('single offscreen document')) {
                        console.log('Offscreen document already exists, continuing...');
                        return;
                    }
                    throw createError;
                }
            } else {
                console.log('Offscreen document already exists');
            }
        } catch (error) {
            console.error('Error in ensureOffscreenDocument:', error);
            // Don't throw the error, just log it
        }
    }
}