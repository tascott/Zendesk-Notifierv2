window.addEventListener('load',() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');

    if(accessToken) {
        chrome.runtime.sendMessage({type: 'OAUTH_TOKEN',token: accessToken},() => {
            window.close();
        });
    } else {
        console.error('No access token found in URL');
    }
});