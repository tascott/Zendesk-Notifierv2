chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PLAY_SOUND') {
        const audio = document.getElementById('notificationSound');
        audio.volume = 0.5;
        audio.play();
    }
});
