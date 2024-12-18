document.addEventListener('DOMContentLoaded', async () => {
    // Check for token in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        console.log('Received token from redirect');
        await chrome.storage.local.set({ 'zauth': token });
        // Clear the URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        updateAuthStatus('Authenticated');
    }

    // Load saved settings
    const storage = await chrome.storage.local.get(['zendeskDomain', 'zauth', 'checkInterval']);

    if (storage.zendeskDomain) {
        document.getElementById('domain').value = storage.zendeskDomain;
    }

    updateAuthStatus(storage.zauth ? 'Authenticated' : 'Not authenticated');

    // Add event listener for the auth button
    document.getElementById('auth-button').addEventListener('click', startAuthFlow);
});

// Form submit handler
document.getElementById('credentials-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const domain = document.getElementById('domain').value.trim();

    await chrome.storage.local.set({ zendeskDomain: domain });
    console.log('Domain saved:', domain);

    // Trigger monitor initialization
    chrome.runtime.sendMessage({type: 'INITIALIZE_MONITOR'});

    alert('Settings saved!');
});

async function startAuthFlow() {
    console.log('Starting auth flow from options page');
    const domain = document.getElementById('domain').value;

    if (!domain) {
        console.error('No domain configured');
        alert('Please enter and save your Zendesk domain first');
        return;
    }

    console.log('Using domain:', domain);

    chrome.runtime.sendMessage({type: 'START_AUTH_FLOW'}, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error starting auth flow:', chrome.runtime.lastError);
        } else {
            console.log('Auth flow response:', response);
        }
    });
}

function updateAuthStatus(status) {
    const statusElement = document.getElementById('auth-status');
    statusElement.textContent = `Authentication Status: ${status}`;
    statusElement.className = status === 'Authenticated' ? 'authenticated' : 'not-authenticated';

    // Log the current auth state
    chrome.storage.local.get(['zauth'], function(result) {
        console.log('Current auth token:', result.zauth ? 'Present' : 'Not present');
    });
}

function readUrlParam(url, param) {
    const paramString = param + '=';
    if (url.includes(paramString)) {
        let start = url.indexOf(paramString) + paramString.length;
        let value = url.substr(start);
        const end = value.indexOf('&');
        if (end !== -1) {
            value = value.substring(0, end);
        }
        return value;
    }
    return null;
}