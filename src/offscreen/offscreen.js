chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PLAY_SOUND') {
        const audio = document.getElementById(message.isUrgent ? 'notificationSound' : 'notificationSound2');
        audio.volume = 0.5;
        audio.play();
    }
});
