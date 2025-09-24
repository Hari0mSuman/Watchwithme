// Room-specific JavaScript functionality

let youtubePlayer = null;
let localVideo = null;
let lastMessageId = 0;
let syncInterval = null;
let chatPollInterval = null;
let roomCode = '';
let isHost = false;
let currentVideoType = '';
let isSyncing = false;
let unreadCount = 0;
let isChatOpen = false;
let lastNotificationTime = 0;
let memberCount = 0;
let lastMemberCount = 0;

// Initialize room functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get room code from URL
    const pathParts = window.location.pathname.split('/');
    roomCode = pathParts[pathParts.length - 1];
    
    // Check if user is host
    const hostIndicator = document.querySelector('[data-host="true"]');
    isHost = hostIndicator !== null;
    
    // Get current video type
    const videoTypeElement = document.querySelector('[data-video-type]');
    currentVideoType = videoTypeElement ? videoTypeElement.dataset.videoType : '';
    
    // Initialize member count and list
    initializeMemberData();
    
    // Initialize mobile notifications
    initializeMobileNotifications();
    
    // Start polling for updates
    startPolling();
    
    // Initialize YouTube player if needed (after URL is resolved)
    if (currentVideoType === 'youtube') {
        // window.currentVideoUrl is set in initializeMemberData()
        if (window.currentVideoUrl) {
            initializeYouTubePlayer(window.currentVideoUrl);
        } else {
            console.warn('YouTube video type detected but no URL found.');
        }
    }
    
    // Initialize local video if needed
    if (currentVideoType === 'local') {
        initializeLocalVideo();
    }
    
    // Set up chat functionality
    setupChat();
    
    // Initialize chat sidebar state
    initializeChatSidebar();
    
    // Initialize chat polling
    initializeChat();
    
    // Set up video controls
    setupVideoControls();

    // Wire file upload handler (host-only control exists in DOM when host)
    setupFileUpload();

    // Perform an immediate sync on page load
    try {
        syncVideoState();
    } catch (e) {
        console.warn('Initial sync failed:', e);
    }
    
    // Set up mobile chat toggle
    setupMobileChatToggle();
    
    // Set up event listeners
    setupEventListeners();
    
    // Observe chat sidebar for visibility changes
    const chatSidebar = document.getElementById('chatSidebar');
    if (chatSidebar) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    handleChatVisibilityChange();
                }
            });
        });
        observer.observe(chatSidebar, { attributes: true });
    }
});

// Initialize member data
function initializeMemberData() {
    // Get initial member count from the page
    const memberCountElement = document.querySelector('.member-count');
    if (memberCountElement) {
        const match = memberCountElement.textContent.match(/Members \((\d+)\)/);
        if (match) {
            memberCount = parseInt(match[1]);
            lastMemberCount = memberCount;
        }
    }
    
    // Get current video URL from the page
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        const youtubePlayer = videoContainer.querySelector('#youtubePlayer');
        const localVideo = videoContainer.querySelector('#localVideo');
        
        if (youtubePlayer && youtubePlayer.dataset.videoUrl) {
            window.currentVideoUrl = youtubePlayer.dataset.videoUrl;
        } else if (localVideo && localVideo.src) {
            window.currentVideoUrl = localVideo.src;
        }
    }
    
    // Poll for updates immediately
    pollMemberCount();
    pollMemberList();
}

// Setup functions
function setupChat() {
    // Initialize chat functionality
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    
    if (chatForm && chatInput) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            sendChatMessage(e);
        });
        
        // Clear unread count when user starts typing
        chatInput.addEventListener('focus', function() {
            clearUnreadCount();
        });
        
        // Handle Enter key press
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage(e);
            }
        });
    }
}

// Initialize chat sidebar state
function initializeChatSidebar() {
    const chatSidebar = document.getElementById('chatSidebar');
    if (chatSidebar) {
        // Ensure initial state is correct
        if (window.innerWidth <= 770) {
            // Mobile: start closed
            chatSidebar.style.transform = 'translateX(100%)';
            chatSidebar.classList.remove('open');
            console.log('📱 Mobile chat sidebar initialized as closed');
        } else {
            // Desktop: start open
            chatSidebar.style.transform = 'none';
            chatSidebar.classList.add('open');
            console.log('🖥️ Desktop chat sidebar initialized as open');
        }
    }
}

function setupVideoControls() {
    // Set up video control buttons
    const playPauseBtn = document.getElementById('playPauseBtn');
    const seekBackBtn = document.getElementById('seekBackBtn');
    const seekForwardBtn = document.getElementById('seekForwardBtn');
    
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function() {
            // Determine current state and send appropriate action
            if (currentVideoType === 'youtube' && youtubePlayer && typeof youtubePlayer.getPlayerState === 'function') {
                const state = youtubePlayer.getPlayerState();
                const isPlaying = (typeof YT !== 'undefined') && state === YT.PlayerState.PLAYING;
                const time = (typeof youtubePlayer.getCurrentTime === 'function') ? youtubePlayer.getCurrentTime() : 0;
                sendVideoControl(isPlaying ? 'pause' : 'play', time);
            } else if (currentVideoType === 'local' && localVideo) {
                const isPlaying = !localVideo.paused;
                const time = localVideo.currentTime || 0;
                sendVideoControl(isPlaying ? 'pause' : 'play', time);
            }
        });
    }
    
    if (seekBackBtn) {
        seekBackBtn.addEventListener('click', function() {
            let time = 0;
            if (currentVideoType === 'youtube' && youtubePlayer && typeof youtubePlayer.getCurrentTime === 'function') {
                time = Math.max(0, youtubePlayer.getCurrentTime() - 10);
            } else if (currentVideoType === 'local' && localVideo) {
                time = Math.max(0, (localVideo.currentTime || 0) - 10);
            }
            sendVideoControl('seek', time);
        });
    }
    
    if (seekForwardBtn) {
        seekForwardBtn.addEventListener('click', function() {
            let time = 0;
            if (currentVideoType === 'youtube' && youtubePlayer && typeof youtubePlayer.getCurrentTime === 'function') {
                time = youtubePlayer.getCurrentTime() + 10;
            } else if (currentVideoType === 'local' && localVideo) {
                time = (localVideo.currentTime || 0) + 10;
            }
            sendVideoControl('seek', time);
        });
    }
}

function setupMobileChatToggle() {
    console.log('🔧 Setting up mobile chat toggle');
    
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatSidebar = document.getElementById('chatSidebar');
    
    console.log('   chatToggleBtn found:', !!chatToggleBtn);
    console.log('   chatSidebar found:', !!chatSidebar);
    
    if (chatToggleBtn && chatSidebar) {
        chatToggleBtn.addEventListener('click', function() {
            console.log('📱 Mobile chat toggle button clicked (from room.js)');
            toggleMobileChat();
        });
        console.log('✅ Mobile chat toggle event listener added');
    } else {
        console.error('❌ Chat elements not found for mobile toggle setup');
    }
}

function setupEventListeners() {
    // Clear unread count when page becomes visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            clearUnreadCount();
        }
    });
    
    // Clear unread count when document gains focus
    document.addEventListener('focus', function() {
        clearUnreadCount();
    });
}

// Note: Single definition used; accepts videoUrl

function initializeLocalVideo() {
    localVideo = document.getElementById('localVideo');
    if (localVideo) {
        // Improve autoplay compatibility on mobile/guests
        localVideo.setAttribute('playsinline', '');
        if (!isHost) {
            // Many browsers require mute to allow programmatic play without gesture
            localVideo.muted = true;
            // Ensure guests keep controls for volume/fullscreen/progress
            localVideo.setAttribute('controls', '');
        }
        setupLocalVideoEvents();
    }
}

// YouTube Player Integration
function initializeYouTubePlayer(videoUrl) {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) return;
    
    if (typeof YT !== 'undefined' && YT.Player) {
        createYouTubePlayer(videoId);
    } else {
        // Wait for YouTube API to load
        window.onYouTubeIframeAPIReady = () => createYouTubePlayer(videoId);
    }
}

function createYouTubePlayer(videoId) {
    youtubePlayer = new YT.Player('youtubePlayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            // Guests see controls for volume/fullscreen/progress, but we'll override state changes via sync
            controls: 1,
            disablekb: false,
            fs: 1,
            playsinline: 1,
            modestbranding: 1,
            enablejsapi: 1,
            rel: 0,
            showinfo: 0
        },
        events: {
            onReady: onYouTubePlayerReady,
            onStateChange: onYouTubePlayerStateChange,
            onError: onYouTubePlayerError
        }
    });
}

function onYouTubePlayerReady(event) {
    console.log('YouTube player ready');
    // Sync with current room state after a short delay to ensure player is fully loaded
    setTimeout(() => {
        syncVideoState();
    }, 1000);
    // For guests, attempt to auto-play muted if host is playing
    if (!isHost) {
        fetch(`/room/${roomCode}/video-sync`)
            .then(r => r.json())
            .then(data => {
                if (data && data.video_type === 'youtube' && data.is_playing) {
                    try {
                        if (typeof youtubePlayer.mute === 'function') youtubePlayer.mute();
                        youtubePlayer.playVideo();
                    } catch (e) {
                        console.warn('Guest autoplay attempt failed:', e);
                    }
                }
            })
            .catch(() => {});
    }
}

function onYouTubePlayerError(event) {
    // YouTube error codes: 2, 5, 100, 101, 150
    const code = event && typeof event.data !== 'undefined' ? event.data : 'unknown';
    let message = 'YouTube video cannot be played here.';
    if (code === 101 || code === 150) {
        message = 'Embedding disabled by the video owner. Please choose another video.';
    } else if (code === 100) {
        message = 'Video not found or removed.';
    } else if (code === 5) {
        message = 'HTML5 player error. Try reloading the page.';
    }
    try {
        if (window.WatchWithMe && typeof WatchWithMe.showNotification === 'function') {
            WatchWithMe.showNotification(message, 'error');
        } else {
            alert(message);
        }
    } catch (e) {}
}

function onYouTubePlayerStateChange(event) {
    if (!isHost || isSyncing) return;
    
    const currentTime = youtubePlayer.getCurrentTime();
    let action = null;
    
    console.log('YouTube state change:', event.data);
    
    switch (event.data) {
        case YT.PlayerState.PLAYING:
            action = 'play';
            break;
        case YT.PlayerState.PAUSED:
            action = 'pause';
            break;
        case YT.PlayerState.ENDED:
            action = 'pause';
            break;
    }
    
    if (action) {
        console.log('Sending video control:', action, currentTime);
        sendVideoControl(action, currentTime);
        // Trigger immediate sync after host action for quicker propagation
        setTimeout(syncVideoState, 150);
    }
}

// Local Video Integration
function setupLocalVideoEvents() {
    if (!localVideo) return;
    
    // Guests: keep controls for fullscreen/volume/progress; don't block play to avoid unexpected stops
    if (!isHost) {
        // Prevent user-driven seek from affecting room state; we'll correct position on next sync
        localVideo.addEventListener('seeking', () => {
            // Revert to server time on next sync
            syncVideoState();
        });
        // Keep controls for volume/fullscreen; do not return so we still attach handlers below as needed
    }
    
    localVideo.addEventListener('play', () => {
        if (!isSyncing) {
            sendVideoControl('play', localVideo.currentTime);
        }
    });
    
    localVideo.addEventListener('pause', () => {
        if (!isSyncing) {
            sendVideoControl('pause', localVideo.currentTime);
        }
    });
    
    localVideo.addEventListener('seeked', () => {
        if (!isSyncing) {
            sendVideoControl('seek', localVideo.currentTime);
        }
    });
}

// Video Control Functions
function loadYouTubeVideo() {
    const urlInput = document.getElementById('youtubeUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
        WatchWithMe.showNotification('Please enter a YouTube URL', 'error');
        return;
    }
    
    const videoId = extractYouTubeId(url);
    if (!videoId) {
        WatchWithMe.showNotification('Invalid YouTube URL', 'error');
        return;
    }
    
    fetch(`/room/${roomCode}/video-control`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'load_youtube',
            url: url
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            WatchWithMe.showNotification('YouTube video loaded successfully', 'success');
            urlInput.value = '';
            
            // Update current video URL
            window.currentVideoUrl = url;
            
            // Reload page to show new video
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            WatchWithMe.showNotification(data.error || 'Failed to load video', 'error');
        }
    })
    .catch(error => {
        console.error('Error loading YouTube video:', error);
        WatchWithMe.showNotification('Failed to load video', 'error');
    });
}

function sendVideoControl(action, time = 0) {
    console.log('Sending video control:', { action, time, isHost });
    
    fetch(`/room/${roomCode}/video-control`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: action,
            time: time
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Video control failed:', data.error);
        } else {
            console.log('Video control successful:', action);
        }
    })
    .catch(error => {
        console.error('Error sending video control:', error);
    });
}

// Video Synchronization
function syncVideoState() {
    fetch(`/room/${roomCode}/video-sync`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Sync error:', data.error);
                return;
            }
            
            // Update current video URL if it's new
            if (data.video_url && data.video_url !== window.currentVideoUrl) {
                window.currentVideoUrl = data.video_url;
                console.log('Video URL updated:', data.video_url);
                // If local video type, ensure the <video> element source is updated and loaded
                if (data.video_type === 'local') {
                    if (!localVideo) {
                        localVideo = document.getElementById('localVideo');
                    }
                    if (localVideo) {
                        const sourceEl = localVideo.querySelector('source');
                        const currentSrc = sourceEl ? sourceEl.getAttribute('src') : localVideo.currentSrc;
                        if (!currentSrc || currentSrc !== data.video_url) {
                            if (sourceEl) {
                                sourceEl.setAttribute('src', data.video_url);
                            } else {
                                // Fallback: set src directly on video element
                                localVideo.src = data.video_url;
                            }
                            try {
                                localVideo.load();
                            } catch (e) {
                                console.warn('Video load() failed:', e);
                            }
                        }
                    }
                }
            }
            
            // Sync video state based on type
            if (data.video_type === 'youtube') {
                // Toggle visibility
                toggleVideoElements('youtube');
                // Initialize YouTube player if needed
                if (!youtubePlayer || typeof youtubePlayer.getPlayerState !== 'function') {
                    initializeYouTubePlayer(window.currentVideoUrl || (document.getElementById('youtubePlayer')?.dataset.videoUrl || ''));
                }
                syncYouTubePlayer(data);
            } else if (data.video_type === 'local') {
                // Toggle visibility
                toggleVideoElements('local');
                syncLocalVideo(data);
            } else {
                toggleVideoElements('none');
            }
        })
        .catch(error => {
            console.error('Error syncing video state:', error);
        });
}

function syncYouTubePlayer(data) {
    if (!youtubePlayer || typeof youtubePlayer.getPlayerState !== 'function') {
        console.log('YouTube player not ready for sync');
        return;
    }
    
    // Force-load correct video if mismatched
    try {
        const targetVideoId = extractYouTubeId(window.currentVideoUrl || data.video_url || '');
        const currentVideoId = (typeof youtubePlayer.getVideoData === 'function') ? (youtubePlayer.getVideoData().video_id || null) : null;
        if (targetVideoId && targetVideoId !== currentVideoId) {
            if (data.is_playing) {
                youtubePlayer.loadVideoById({ videoId: targetVideoId, startSeconds: data.current_time || 0, suggestedQuality: 'default' });
            } else {
                youtubePlayer.cueVideoById({ videoId: targetVideoId, startSeconds: data.current_time || 0, suggestedQuality: 'default' });
            }
        }
    } catch (e) {
        console.warn('Failed to (re)load YouTube video by ID:', e);
    }

    const currentTime = youtubePlayer.getCurrentTime();
    const targetTime = data.current_time;
    const timeDiff = Math.abs(currentTime - targetTime);
    const playerState = youtubePlayer.getPlayerState();
    
    console.log('YouTube sync:', { 
        currentTime, 
        targetTime, 
        timeDiff, 
        isPlaying: data.is_playing,
        playerState: playerState,
        playerStates: {
            UNSTARTED: YT.PlayerState.UNSTARTED,
            ENDED: YT.PlayerState.ENDED,
            PLAYING: YT.PlayerState.PLAYING,
            PAUSED: YT.PlayerState.PAUSED,
            BUFFERING: YT.PlayerState.BUFFERING,
            CUED: YT.PlayerState.CUED
        }
    });
    
    // Sync time if difference is more than 0.4s
    if (timeDiff > 0.4) {
        console.log('Seeking to:', targetTime);
        youtubePlayer.seekTo(targetTime, true);
    }
    
    // Sync play/pause state
    if (data.is_playing) {
        // If host is playing, we should play too
        if (playerState === YT.PlayerState.PAUSED || 
            playerState === YT.PlayerState.CUED || 
            playerState === YT.PlayerState.ENDED) {
            console.log('Playing video (host is playing)');
            // Improve autoplay success on guests by muting first
            if (!isHost && typeof youtubePlayer.mute === 'function') {
                youtubePlayer.mute();
            }
            youtubePlayer.playVideo();
        }
    } else {
        // If host is paused, we should pause too
        if (playerState === YT.PlayerState.PLAYING || 
            playerState === YT.PlayerState.BUFFERING) {
            console.log('Pausing video (host is paused)');
            youtubePlayer.pauseVideo();
        }
    }
}

function syncLocalVideo(data) {
    if (!localVideo) return;
    
    isSyncing = true;
    const currentTime = localVideo.currentTime;
    const targetTime = data.current_time;
    const timeDiff = Math.abs(currentTime - targetTime);
    
    // Sync time if difference is more than 0.4s
    if (timeDiff > 0.4) {
        localVideo.currentTime = targetTime;
    }
    
    // Sync play/pause state
    if (data.is_playing && localVideo.paused) {
        localVideo.play().catch(console.error);
    } else if (!data.is_playing && !localVideo.paused) {
        localVideo.pause();
    }

    isSyncing = false;
}

// Chat Functions
function initializeChat() {
    // Get the last message ID for polling
    const lastMessage = document.querySelector('#chatMessages .message:last-child');
    if (lastMessage && lastMessage.dataset.messageId) {
        lastMessageId = parseInt(lastMessage.dataset.messageId);
    }
}

function sendChatMessage(event) {
    if (event) {
        event.preventDefault();
    }
    
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    fetch(`/room/${roomCode}/send-message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.id) {
            chatInput.value = '';
            addChatMessage(data);
            lastMessageId = data.id;
        } else {
            console.error('Failed to send message:', data.error);
            alert(data.error || 'Failed to send message');
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    });
}

function addChatMessage(messageData) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = messageData.id;
    
    if (messageData.type === 'system') {
        messageDiv.innerHTML = `
            <div class="text-center">
                <span class="text-xs text-gray-500 bg-discord-darkest px-2 py-1 rounded">
                    ${messageData.message}
                </span>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="space-y-1">
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-medium text-white">${messageData.user_name}</span>
                    <span class="text-xs text-gray-500">${messageData.time}</span>
                </div>
                <p class="text-discord-text text-sm">${messageData.message}</p>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function pollChatMessages() {
    fetch(`/room/${roomCode}/messages?after_id=${lastMessageId}`)
        .then(response => response.json())
        .then(messages => {
            let newMessages = 0;
            messages.forEach(message => {
                addChatMessage(message);
                lastMessageId = Math.max(lastMessageId, message.id);
                newMessages++;
            });
            
            // Handle unread messages for mobile
            if (newMessages > 0 && !isChatVisible()) {
                // Increment unread count
                unreadCount += newMessages;
                updateUnreadCount(unreadCount);
                
                // Show mobile notification for new messages
                const now = Date.now();
                if (now - lastNotificationTime > 5000) { // Limit notifications to every 5 seconds
                    const latestMessage = messages[messages.length - 1];
                    if (latestMessage && latestMessage.type !== 'system') {
                        showMobileNotification(latestMessage);
                        lastNotificationTime = now;
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error polling chat messages:', error);
        });
}

// File Upload
function setupFileUpload() {
    const fileInput = document.getElementById('videoFile');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', handleVideoUpload);
}

function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Relax client-side type check: accept any video/* and defer to backend validation
    if (!file.type || !file.type.startsWith('video/')) {
        WatchWithMe.showNotification('Please select a valid video file', 'error');
        return;
    }
    
    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
        WatchWithMe.showNotification('File size must be less than 500MB', 'error');
        return;
    }
    
    uploadVideoFile(file);
}

function uploadVideoFile(file) {
    const formData = new FormData();
    formData.append('video', file);
    
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadBar');
    
    progressDiv.classList.remove('hidden');
    progressBar.style.width = '0%';
    
    fetch(`/room/${roomCode}/upload-video`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        progressDiv.classList.add('hidden');
        
        if (data.success) {
            WatchWithMe.showNotification('Video uploaded successfully', 'success');
            
            // Reload page to show new video
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            WatchWithMe.showNotification(data.error || 'Upload failed', 'error');
        }
    })
    .catch(error => {
        progressDiv.classList.add('hidden');
        console.error('Upload error:', error);
        WatchWithMe.showNotification('Upload failed', 'error');
    });
    
    // Simulate upload progress (since we can't track real progress with fetch)
    simulateUploadProgress(progressBar);
}

function simulateUploadProgress(progressBar) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 95) {
            clearInterval(interval);
            return;
        }
        progressBar.style.width = progress + '%';
    }, 200);
}

// Polling Functions
function startPolling() {
    // Sync video state (faster for guests for tighter alignment)
    const syncMs = isHost ? 2000 : 1000;
    syncInterval = setInterval(syncVideoState, syncMs);
    
    // Poll chat messages every 5 seconds (reduced from 3 seconds)
    chatPollInterval = setInterval(pollChatMessages, 5000);
    
    // Poll member count every 10 seconds (reduced from 5 seconds)
    setInterval(pollMemberCount, 10000);
    
    // Poll member list every 15 seconds (reduced from 8 seconds)
    setInterval(pollMemberList, 15000);
    
    // Host heartbeat more frequently for smooth sync
    if (isHost) {
        setInterval(sendHeartbeat, 2000);
    }
    
    // Check if YouTube player is ready every 15 seconds (reduced from 8 seconds)
    if (!isHost && currentVideoType === 'youtube') {
        setInterval(checkYouTubePlayerReady, 15000);
    }
}

function checkYouTubePlayerReady() {
    if (youtubePlayer && typeof youtubePlayer.getPlayerState === 'function') {
        console.log('YouTube player is now ready');
        // Force a sync when player becomes ready
        syncVideoState();
    }
}

function sendHeartbeat() {
    if (!isHost) return;
    
    let currentTime = 0;
    let isPlaying = false;
    
    if (youtubePlayer && typeof youtubePlayer.getCurrentTime === 'function') {
        currentTime = youtubePlayer.getCurrentTime();
        isPlaying = youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING;
    } else if (localVideo && !localVideo.paused) {
        currentTime = localVideo.currentTime;
        isPlaying = true;
    }
    
    if (currentTime > 0 && isPlaying) {
        sendVideoControl('heartbeat', currentTime);
    }
}

function stopPolling() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }
}

// Utility Functions
function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function toggleVideoElements(type) {
    const yt = document.getElementById('youtubePlayer');
    const lv = document.getElementById('localVideo');
    const placeholder = document.getElementById('noVideoPlaceholder');
    if (yt) yt.style.display = (type === 'youtube') ? 'block' : 'none';
    if (lv) lv.style.display = (type === 'local') ? 'block' : 'none';
    if (placeholder) placeholder.style.display = (type === 'none') ? 'block' : 'none';
}

// Cleanup when leaving page
window.addEventListener('beforeunload', () => {
    stopPolling();
});

// Handle visibility change to pause/resume polling
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPolling();
    } else {
        startPolling();
        syncVideoState(); // Immediate sync when returning
        // Clear unread count when page becomes visible
        clearUnreadCount();
    }
});

// Handle page focus/blur for notifications
document.addEventListener('focus', () => {
    // Clear unread count when page gains focus
    clearUnreadCount();
});

document.addEventListener('blur', () => {
    // Page lost focus, notifications will be shown
});

// Chat visibility functions
function handleChatVisibilityChange() {
    if (isChatVisible()) {
        clearUnreadCount();
    }
}

function toggleMobileChat() {
    console.log('🔍 toggleMobileChat called');
    console.log('   Window width:', window.innerWidth);
    
    // Only work on mobile
    if (window.innerWidth > 770) {
        console.log('   Desktop detected - chat toggle not needed');
        return;
    }
    
    const chatSidebar = document.getElementById('chatSidebar');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    
    console.log('   chatSidebar:', chatSidebar);
    console.log('   chatToggleBtn:', chatToggleBtn);
    
    if (chatSidebar && chatToggleBtn) {
        const currentTransform = chatSidebar.style.transform;
        const hasOpenClass = chatSidebar.classList.contains('open');
        
        console.log('   Current transform:', currentTransform);
        console.log('   Has open class:', hasOpenClass);
        
        // Check if chat is open (either transform is 0px or has open class)
        const isOpen = currentTransform === 'translateX(0px)' || hasOpenClass;
        
        console.log('   Is open:', isOpen);
        
        if (isOpen) {
            // Close chat
            console.log('   Closing chat');
            chatSidebar.style.transform = 'translateX(100%)';
            chatSidebar.classList.remove('open');
            isChatOpen = false;
        } else {
            // Open chat
            console.log('   Opening chat');
            chatSidebar.style.transform = 'translateX(0px)';
            chatSidebar.classList.add('open');
            isChatOpen = true;
            if (typeof clearUnreadCount === 'function') {
                clearUnreadCount();
            }
        }
        
        console.log('   Final transform:', chatSidebar.style.transform);
        console.log('   Final open class:', chatSidebar.classList.contains('open'));
    } else {
        console.error('❌ Chat elements not found');
        console.log('   chatSidebar found:', !!chatSidebar);
        console.log('   chatToggleBtn found:', !!chatToggleBtn);
    }
}

// Member count functions
function updateMemberCount(count) {
    memberCount = count;
    const memberCountElements = document.querySelectorAll('.member-count');
    memberCountElements.forEach(element => {
        element.textContent = `Members (${count})`;
    });
}

function pollMemberCount() {
    fetch(`/room/${roomCode}/member-count`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.count !== lastMemberCount) {
                updateMemberCount(data.count);
                lastMemberCount = data.count;
                console.log('Member count updated:', data.count);
            }
        })
        .catch(error => {
            console.error('Error polling member count:', error);
        });
}

// Member list functions
function updateMemberList(members) {
    const memberListContainer = document.querySelector('.mobile-members .space-y-2');
    if (!memberListContainer) return;
    
    memberListContainer.innerHTML = '';
    
    members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'flex items-center space-x-2';
        
        // Since User model doesn't have profile_image_url, always use default avatar
        const profileHtml = `<div class="w-6 h-6 bg-discord-accent rounded-full flex items-center justify-center">
            <i class="fas fa-user text-white text-xs"></i>
        </div>`;
        
        const hostIcon = member.role === 'host' ? '<i class="fas fa-crown text-yellow-500 text-xs"></i>' : '';
        
        memberDiv.innerHTML = `
            ${profileHtml}
            <span class="text-discord-text text-sm">${member.display_name}</span>
            ${hostIcon}
        `;
        
        memberListContainer.appendChild(memberDiv);
    });
}

function pollMemberList() {
    fetch(`/room/${roomCode}/members`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateMemberList(data.members);
            }
        })
        .catch(error => {
            console.error('Error polling member list:', error);
        });
}

// Check if chat is visible
function isChatVisible() {
    const chatSidebar = document.getElementById('chatSidebar');
    if (!chatSidebar) return false;
    
    // On mobile, check if sidebar is open
    if (window.innerWidth <= 770) {
        return chatSidebar.style.transform === 'translateX(0px)' || 
               chatSidebar.classList.contains('open');
    }
    
    // On desktop, chat is always visible
    return true;
}

// Update unread count based on chat visibility
function updateUnreadCountBasedOnVisibility() {
    if (isChatVisible()) {
        clearUnreadCount();
    }
}

// Mobile notification functions
function initializeMobileNotifications() {
    if (typeof Notification !== 'undefined') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted.');
            } else {
                console.log('Notification permission denied.');
            }
        });
    }
}

function showNotification(title, message, icon) {
    if (typeof Notification !== 'undefined') {
        new Notification(title, {
            body: message,
            icon: icon
        });
    } else {
        console.log('Notification API not supported.');
    }
}

function showMobileNotification(messageData) {
    if (typeof Notification !== 'undefined') {
        const title = messageData.user_name ? `${messageData.user_name}: ${messageData.message}` : messageData.message;
        new Notification(title, {
            body: messageData.message,
            icon: 'https://www.youtube.com/favicon.ico' // Use a placeholder icon
        });
    } else {
        console.log('Notification API not supported for mobile.');
    }
}

function updateUnreadCount(count) {
    unreadCount = count;
    const unreadBadge = document.getElementById('unreadBadge');
    if (unreadBadge) {
        unreadBadge.textContent = count > 0 ? count : '';
        unreadBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

function clearUnreadCount() {
    unreadCount = 0;
    updateUnreadCount(0);
}

function incrementUnreadCount() {
    unreadCount++;
    updateUnreadCount(unreadCount);
}

function decrementUnreadCount() {
    unreadCount--;
    updateUnreadCount(unreadCount);
}

// Export functions for global access
window.roomFunctions = {
    loadYouTubeVideo,
    toggleMobileChat,
    syncVideoState,
    updateUnreadCount,
    clearUnreadCount,
    incrementUnreadCount,
    decrementUnreadCount
};

// Make functions globally accessible
window.toggleMobileChat = toggleMobileChat;
window.clearUnreadCount = clearUnreadCount;
window.initializeChatSidebar = initializeChatSidebar;
