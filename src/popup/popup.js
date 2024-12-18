document.addEventListener('DOMContentLoaded', async () => {
    const monitorActiveToggle = document.getElementById('monitorActiveToggle');
    const fetchAllNewToggle = document.getElementById('fetchAllNewToggle');
    const checkIntervalSelect = document.getElementById('checkInterval');

    if (!fetchAllNewToggle) {
        console.error('Toggle element not found');
        return;
    }

    // Combined storage get
    const storage = await chrome.storage.local.get([
        'recentTickets',
        'lastCheck',
        'zendeskDomain',
        'fetchAllNewTickets',
        'isMonitorActive',
        'checkInterval'
    ]);

    const ticketsDiv = document.getElementById('tickets');
    const lastCheckSpan = document.getElementById('lastCheck');

    // Set initial toggle states, default isMonitorActive to true
    monitorActiveToggle.checked = storage.isMonitorActive !== false; // Will be true unless explicitly set to false
    fetchAllNewToggle.checked = storage.fetchAllNewTickets || false;
    checkIntervalSelect.value = storage.checkInterval || '0.5';

    // Function to display tickets
    function displayTickets() {
        chrome.storage.local.get(['recentTickets', 'lastCheck', 'zendeskDomain', 'fetchAllNewTickets'], (storage) => {
            if (storage.lastCheck) {
                lastCheckSpan.textContent = storage.lastCheck;
            }

            if (storage.recentTickets && storage.recentTickets.length > 0) {
                let ticketsToShow = storage.recentTickets;
                if (storage.fetchAllNewTickets) {
                    ticketsToShow = storage.recentTickets.filter(ticket => ticket.status === 'new');
                }

                if (ticketsToShow.length === 0) {
                    ticketsDiv.textContent = 'No tickets found';
                    return;
                }

                ticketsDiv.innerHTML = ticketsToShow.map(ticket => `
                    <div class="ticket ${ticket.status === 'new' ? 'new-ticket' : ''}">
                        <a href="https://${storage.zendeskDomain}.zendesk.com/agent/tickets/${ticket.id}" target="_blank">
                            #${ticket.id}: ${ticket.subject}
                        </a>
                        <div>Status: ${ticket.status}</div>
                        <div>Created: ${new Date(ticket.created_at).toLocaleString()}</div>
                        <div>Priority: ${ticket.priority || 'Not set'}</div>
                    </div>
                `).join('');
            } else {
                ticketsDiv.textContent = 'No tickets found';
            }
        });
    }

    // Add toggle event listener
    fetchAllNewToggle.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ fetchAllNewTickets: e.target.checked });
        chrome.runtime.sendMessage({
            type: 'UPDATE_FETCH_SETTING',
            fetchAllNew: e.target.checked
        });

        // Wait a bit for the background process to fetch new tickets
        setTimeout(displayTickets, 1000);
    });

    // Add monitor active toggle listener
    monitorActiveToggle.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ isMonitorActive: e.target.checked });
        chrome.runtime.sendMessage({
            type: 'UPDATE_MONITOR_ACTIVE',
            isActive: e.target.checked
        });
    });

    // Add interval change listener
    checkIntervalSelect.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ checkInterval: e.target.value });
        chrome.runtime.sendMessage({ type: 'UPDATE_CHECK_INTERVAL' });
        updateApiCallCount(e.target.value);
    });

    // Function to update API call count
    function updateApiCallCount(interval) {
        const minutesIn12Hours = 12 * 60;
        const callCount = Math.floor(minutesIn12Hours / parseFloat(interval));
        document.getElementById('apiCallCount').textContent = callCount;
    }

    // Initial API call count update
    updateApiCallCount(storage.checkInterval || '0.5');

    // Initial display of tickets
    displayTickets();

    // Reset badge when popup is opened
    chrome.action.setBadgeText({ text: '' });

    // Force a check for new tickets
    chrome.runtime.sendMessage({type: 'INITIALIZE_MONITOR'});
});
