import {ZendeskMonitor} from './ZendeskMonitor.js';

const monitor = new ZendeskMonitor();

// Initialize monitoring on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed, initializing monitor...');
    const initialized = await monitor.initialize();
    if (initialized) {
        console.log('Monitor initialized, starting periodic check');
        startPeriodicCheck();
    } else {
        console.log('Monitor failed to initialize');
    }
});

// Listen for settings changes
chrome.storage.onChanged.addListener(async (changes) => {
    if(changes.zendeskDomain || changes.zauth) {
        console.log('Settings changed, reinitializing');
        await monitor.initialize();
        startPeriodicCheck();
    }
});

// Listen for messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INITIALIZE_MONITOR') {
        console.log('Initializing monitor');
        monitor.initialize();
    }
    if (message.type === 'OAUTH_TOKEN') {
        console.log('Received OAuth token');
        chrome.storage.local.set({ 'zauth': message.token }, () => {
            console.log('OAuth token saved');
            monitor.initialize();
        });
    }
    if (message.type === 'START_AUTH_FLOW') {
        console.log('Starting auth flow from background');
        monitor.startAuthFlow()
            .then(() => sendResponse({status: 'Auth flow started'}))
            .catch(error => {
                console.error('Auth flow error:', error);
                sendResponse({status: 'Auth flow failed', error: error.message});
            });
        return true;
    }
    if (message.type === 'DEBUG_ALARMS') {
        debugAlarms().then(() => sendResponse({status: 'Debug complete'}));
        return true;
    }
    if (message.type === 'UPDATE_FETCH_SETTING') {
        monitor.fetchAllNewTickets = message.fetchAllNew;
        monitor.checkNewTickets(); // Trigger immediate check with new setting
    }
    if (message.type === 'UPDATE_MONITOR_ACTIVE') {
        monitor.isMonitorActive = message.isActive;
        if (message.isActive) {
            console.log('Monitor activated, starting checks');
            monitor.checkNewTickets();
            startPeriodicCheck();
        } else {
            console.log('Monitor deactivated, stopping checks');
            stopPeriodicCheck();
        }
    }
    if (message.type === 'UPDATE_CHECK_INTERVAL') {
        startPeriodicCheck(); // Restart periodic check with new interval
    }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    console.log('Notification clicked:', notificationId);
    if (notificationId.startsWith('ticket-')) {
        const ticketId = notificationId.split('-')[1];
        const url = `https://${monitor.domain}.zendesk.com/agent/tickets/${ticketId}`;
        console.log('Opening ticket URL:', url);
        chrome.tabs.create({ url });
        chrome.notifications.clear(notificationId);
    }
});

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);
    if (alarm.name === 'checkTickets') {
        console.log('Checking tickets from alarm trigger');
        monitor.checkNewTickets();
    }
});

// Function to start periodic check
async function startPeriodicCheck() {
    console.log('Setting up periodic check...');

    // Get stored interval or use default of 30 seconds
    const storage = await chrome.storage.local.get(['checkInterval']);
    const checkInterval = storage.checkInterval || 0.5;

    // Clear any existing alarms
    chrome.alarms.clear('checkTickets', (wasCleared) => {
        console.log('Previous alarm cleared:', wasCleared);

        // Create new alarm with stored interval
        chrome.alarms.create('checkTickets', {
            periodInMinutes: parseFloat(checkInterval), // Convert string to number
            delayInMinutes: 0  // Start immediately
        });

        console.log('New alarm created with interval:', checkInterval, 'minutes');

        // Do an immediate check
        console.log('Performing immediate check');
        monitor.checkNewTickets();

        // Debug: List all active alarms
        chrome.alarms.getAll((alarms) => {
            console.log('Current alarms:', alarms);
        });
    });
}

// Debug function to check alarm status
async function debugAlarms() {
    const alarms = await chrome.alarms.getAll();
    console.log('Current alarms:', alarms);

    // Check if monitor is initialized
    console.log('Monitor initialized:', monitor.isInitialized);

    // Check stored credentials
    const storage = await chrome.storage.local.get(['zauth', 'zendeskDomain']);
    console.log('Has auth token:', !!storage.zauth);
    console.log('Has domain:', !!storage.zendeskDomain);
}

// Start periodic check when background script loads
console.log('Background script loaded, initializing...');
monitor.initialize().then(initialized => {
    if (initialized) {
        console.log('Monitor initialized on load, starting periodic check');
        startPeriodicCheck();
    } else {
        console.log('Monitor failed to initialize on load');
    }
});

// Add this function to stop periodic checks
function stopPeriodicCheck() {
    chrome.alarms.clear('checkTickets');
}