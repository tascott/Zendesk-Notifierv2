// Load audio files when the document loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Offscreen document loaded');
    const sound1 = document.getElementById('notificationSound');
    const sound2 = document.getElementById('notificationSound2');

    // Load the audio files
    sound1.load();
    sound2.load();

    console.log('Audio elements initialized:', {
        sound1: sound1 ? 'found' : 'missing',
        sound2: sound2 ? 'found' : 'missing'
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message in offscreen:', message);

    if (message.type === 'PLAY_SOUND') {
        console.log('Playing sound, isUrgent:', message.isUrgent);
        const audioId = message.isUrgent ? 'notificationSound' : 'notificationSound2';
        console.log('Selected audio ID:', audioId);
        const audio = document.getElementById(audioId);

        if (!audio) {
            const error = `Audio element not found: ${audioId}`;
            console.error(error);
            sendResponse({ error });
            return;
        }

        // Reset the audio to the start
        audio.currentTime = 0;
        audio.volume = 0.5;

        // Play with error handling
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log(`Successfully playing ${audioId}`);
                    sendResponse({ success: true });
                })
                .catch(error => {
                    console.error('Detailed audio error:', error);
                    sendResponse({ error: error.message });
                });
            return true; // Keep the message channel open for the async response
        }
    }
});
