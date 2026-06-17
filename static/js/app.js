// Global State
let releaseNotesData = null;
let allItems = []; // Array of individual parsed release note items
let selectedItems = new Set(); // Set of item IDs that are checked
let activeFilterType = 'all';
let searchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const retryBtn = document.getElementById('retry-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const searchInput = document.getElementById('search-input');
const typeFilters = document.getElementById('type-filters');
const releaseNotesContainer = document.getElementById('release-notes-container');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const lastSyncTime = document.getElementById('last-sync-time');
const feedStatusText = document.getElementById('feed-status-text');

// Floating Bar Elements
const floatingActionBar = document.getElementById('floating-action-bar');
const selectedCountBadge = document.getElementById('selected-count-badge');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const composeSelectedBtn = document.getElementById('compose-selected-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const closeModalBtn = document.getElementById('close-modal-btn');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const submitTweetBtn = document.getElementById('submit-tweet-btn');
const toastContainer = document.getElementById('toast-container');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    if (retryBtn) retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Search input event with simple debounce
    let searchDebounce;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterAndRender();
        }, 200);
    });

    // Filter pills
    typeFilters.addEventListener('click', (e) => {
        const button = e.target.closest('.filter-pill');
        if (!button) return;
        
        // Update active class
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        activeFilterType = button.dataset.type;
        filterAndRender();
    });

    // Floating bar actions
    clearSelectionBtn.addEventListener('click', clearSelection);
    composeSelectedBtn.addEventListener('click', () => openTweetComposer(Array.from(selectedItems)));

    // Modal Close
    closeModalBtn.addEventListener('click', closeComposer);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeComposer();
    });

    // Modal actions
    tweetTextarea.addEventListener('input', updateCharCounter);
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    submitTweetBtn.addEventListener('click', postToTwitter);
}

// Fetch Release Notes
async function fetchReleaseNotes(forceRefresh = false) {
    showState('loading');
    
    // Add visual spin to refresh button
    refreshIcon.classList.add('spinning');
    refreshBtn.disabled = true;
    
    const url = forceRefresh ? '/api/release-notes/refresh' : '/api/release-notes';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success') {
            releaseNotesData = data;
            
            // Format Last Synced time
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            lastSyncTime.textContent = `Last synced: ${timeString}`;
            feedStatusText.textContent = 'Active';
            feedStatusText.parentElement.querySelector('.status-dot').className = 'status-dot green';
            
            // Parse feed items into individual notes
            processReleaseNotes(data.entries);
            filterAndRender();
            showState('content');
            
            if (forceRefresh) {
                showToast('Release notes successfully updated!', 'success');
            }
        } else {
            throw new Error(data.message || 'Server encountered an error parsing the feed.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        errorMessage.textContent = error.message || 'Unable to connect to the backend server.';
        feedStatusText.textContent = 'Connection Error';
        feedStatusText.parentElement.querySelector('.status-dot').className = 'status-dot orange';
        showState('error');
        showToast('Failed to sync release notes.', 'error');
    } finally {
        refreshIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

// Parse release notes and separate sections
function processReleaseNotes(entries) {
    allItems = [];
    selectedItems.clear();
    updateFloatingBar();

    entries.forEach((entry, entryIdx) => {
        const rawContent = entry.content || '';
        const entryDate = entry.date;
        const entryLink = entry.link;
        
        // Parse HTML content
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawContent, 'text/html');
        
        const headings = doc.querySelectorAll('h3, h4');
        
        if (headings.length === 0) {
            // Fallback for single section content
            const textContent = doc.body.textContent.trim();
            const type = detectTypeFromText(textContent);
            allItems.push({
                id: `note-${entryIdx}-0`,
                date: entryDate,
                link: entryLink,
                type: type,
                html: rawContent,
                text: textContent
            });
        } else {
            // Extract items grouped by headings
            headings.forEach((heading, headIdx) => {
                const typeText = heading.textContent.trim();
                const type = normalizeType(typeText);
                
                // Get all sibling nodes until the next h3/h4
                const siblings = [];
                let next = heading.nextElementSibling;
                while (next && !['H3', 'H4'].includes(next.tagName)) {
                    siblings.push(next.outerHTML);
                    next = next.nextElementSibling;
                }
                
                const htmlContent = siblings.join('\n');
                
                // Extract clean text content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                const textContent = tempDiv.textContent.trim();
                
                allItems.push({
                    id: `note-${entryIdx}-${headIdx}`,
                    date: entryDate,
                    link: entryLink,
                    rawType: typeText,
                    type: type,
                    html: htmlContent,
                    text: textContent
                });
            });
        }
    });
}

// Helper to normalize types for badges and filtering
function normalizeType(text) {
    const t = text.toLowerCase().trim();
    if (t.includes('feature') || t.includes('new')) return 'feature';
    if (t.includes('announcement') || t.includes('notice')) return 'announcement';
    if (t.includes('deprecat') || t.includes('removal')) return 'deprecation';
    if (t.includes('bug') || t.includes('fix') || t.includes('resolved')) return 'bugfix';
    return 'other';
}

// Auto detect type based on text content
function detectTypeFromText(text) {
    const t = text.toLowerCase();
    if (t.includes('feature') || t.includes('introduced') || t.includes('support for')) return 'feature';
    if (t.includes('announcement') || t.includes('notice')) return 'announcement';
    if (t.includes('deprecat') || t.includes('will be removed')) return 'deprecation';
    if (t.includes('bug') || t.includes('fixed') || t.includes('resolves')) return 'bugfix';
    return 'other';
}

// Filter items and render UI
function filterAndRender() {
    // Apply Filters
    let filtered = allItems;
    
    // Type Filter
    if (activeFilterType !== 'all') {
        filtered = filtered.filter(item => item.type === activeFilterType);
    }
    
    // Search Query Filter
    if (searchQuery) {
        filtered = filtered.filter(item => {
            return item.text.toLowerCase().includes(searchQuery) || 
                   item.date.toLowerCase().includes(searchQuery) ||
                   (item.rawType && item.rawType.toLowerCase().includes(searchQuery));
        });
    }
    
    // Check if empty
    if (filtered.length === 0) {
        showState('empty');
        return;
    }
    
    showState('content');
    renderNotes(filtered);
}

// Render the Timeline notes
function renderNotes(items) {
    releaseNotesContainer.innerHTML = '';
    
    // Group items by date for timeline presentation
    const itemsByDate = {};
    items.forEach(item => {
        if (!itemsByDate[item.date]) {
            itemsByDate[item.date] = [];
        }
        itemsByDate[item.date].push(item);
    });
    
    // Render groups
    Object.keys(itemsByDate).forEach(date => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'timeline-date-group';
        
        // Date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-date-header';
        dateHeader.innerHTML = `
            <div class="timeline-dot"></div>
            <h2 class="date-title">${date}</h2>
        `;
        dateGroup.appendChild(dateHeader);
        
        // Cards stack
        const cardsStack = document.createElement('div');
        cardsStack.className = 'date-cards-stack';
        
        itemsByDate[date].forEach(item => {
            const isChecked = selectedItems.has(item.id);
            const card = document.createElement('div');
            card.className = `note-card ${isChecked ? 'selected' : ''}`;
            card.dataset.id = item.id;
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-badge-container">
                        <span class="type-badge ${item.type}">${item.rawType || item.type}</span>
                    </div>
                    <label class="checkbox-container">
                        Select to combine
                        <input type="checkbox" class="note-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </div>
                <div class="card-content">
                    ${item.html}
                </div>
                <div class="card-footer">
                    <button class="btn btn-card-action btn-tweet-single" data-id="${item.id}">
                        <i class="fa-brands fa-x-twitter"></i> Tweet This
                    </button>
                </div>
            `;
            
            // Event listener for the individual Tweet button
            card.querySelector('.btn-tweet-single').addEventListener('click', (e) => {
                e.stopPropagation();
                openTweetComposer([item.id]);
            });
            
            // Event listener for card click selection
            card.querySelector('.note-checkbox').addEventListener('change', (e) => {
                toggleItemSelection(item.id, e.target.checked);
            });
            
            cardsStack.appendChild(card);
        });
        
        dateGroup.appendChild(cardsStack);
        releaseNotesContainer.appendChild(dateGroup);
    });
}

// Toggle Item Selection
function toggleItemSelection(id, isSelected) {
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    const checkbox = card ? card.querySelector('.note-checkbox') : null;
    
    if (isSelected) {
        selectedItems.add(id);
        if (card) card.classList.add('selected');
        if (checkbox) checkbox.checked = true;
    } else {
        selectedItems.delete(id);
        if (card) card.classList.remove('selected');
        if (checkbox) checkbox.checked = false;
    }
    
    updateFloatingBar();
}

// Update Floating Action Bar state
function updateFloatingBar() {
    const count = selectedItems.size;
    selectedCountBadge.textContent = count;
    
    if (count > 0) {
        floatingActionBar.classList.add('active');
    } else {
        floatingActionBar.classList.remove('active');
    }
}

// Clear all selected items
function clearSelection() {
    selectedItems.forEach(id => {
        toggleItemSelection(id, false);
    });
}

// Clear Search and Filters
function clearFilters() {
    searchInput.value = '';
    searchQuery = '';
    activeFilterType = 'all';
    
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-pill[data-type="all"]').classList.add('active');
    
    filterAndRender();
}

// State display management (loading, error, content, empty)
function showState(state) {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    releaseNotesContainer.classList.add('hidden');
    
    if (state === 'loading') {
        loadingState.classList.remove('hidden');
    } else if (state === 'error') {
        errorState.classList.remove('hidden');
    } else if (state === 'empty') {
        emptyState.classList.remove('hidden');
    } else if (state === 'content') {
        releaseNotesContainer.classList.remove('hidden');
    }
}

// --- Tweet Composer Logic ---

// Open composer with selected items
function openTweetComposer(ids) {
    if (ids.length === 0) return;
    
    let draftText = '';
    
    if (ids.length === 1) {
        // Single update draft
        const item = allItems.find(i => i.id === ids[0]);
        if (item) {
            const typeStr = item.rawType ? `${item.rawType}` : 'Update';
            
            // Formulate standard clean text
            const intro = `📢 BigQuery Update (${item.date}): ${typeStr}\n\n`;
            const footer = `\n\n#BigQuery #GoogleCloud #DataPlatform`;
            
            // Get available char length for body text (taking link into account)
            // Twitter handles links as 23 chars. 
            // Intro length + Link length (23) + Footer length + extra spacing
            const fixedChars = intro.length + 23 + footer.length + 5; 
            const maxBodyLength = 280 - fixedChars;
            
            let bodyText = item.text;
            if (bodyText.length > maxBodyLength) {
                bodyText = bodyText.substring(0, maxBodyLength - 3) + '...';
            }
            
            draftText = `${intro}${bodyText}${footer}\n${item.link}`;
        }
    } else {
        // Combined update draft
        const selectedNotes = allItems.filter(item => ids.includes(item.id));
        const intro = `🚀 Latest Google BigQuery Updates:\n\n`;
        const footer = `\n#BigQuery #GoogleCloud #DataEngineering`;
        
        let bodyText = '';
        selectedNotes.forEach(item => {
            const typeStr = item.rawType ? `[${item.rawType}]` : '';
            const line = `• ${item.date}: ${typeStr} ${item.text}\n`;
            bodyText += line;
        });
        
        // Calculate max allowed characters
        // Combined updates tweet should link to the main release notes page
        const bqLink = 'https://docs.cloud.google.com/bigquery/docs/release-notes';
        const fixedChars = intro.length + 23 + footer.length + 5;
        const maxBodyLength = 280 - fixedChars;
        
        if (bodyText.length > maxBodyLength) {
            bodyText = bodyText.substring(0, maxBodyLength - 3) + '...';
        }
        
        draftText = `${intro}${bodyText}${footer}\n${bqLink}`;
    }
    
    tweetTextarea.value = draftText;
    updateCharCounter();
    
    // Open modal
    tweetModal.classList.add('active');
}

// Close composer modal
function closeComposer() {
    tweetModal.classList.remove('active');
}

// Character Count logic (adjusts for Twitter url shortening rules)
function updateCharCounter() {
    const text = tweetTextarea.value;
    
    // Twitter link rules: Any URL (http:// or https://) counts as 23 characters
    const urlRegex = /https?:\/\/[^\s]+/g;
    
    // Replace all urls in text with a dummy 23-char string to count accurately
    let parsedText = text.replace(urlRegex, '12345678901234567890123');
    
    const count = parsedText.length;
    charCounter.textContent = `${count} / 280`;
    
    if (count > 280) {
        charCounter.classList.add('error');
        submitTweetBtn.disabled = true;
    } else {
        charCounter.classList.remove('error');
        submitTweetBtn.disabled = false;
    }
}

// Copy Tweet Text
async function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Tweet draft copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy text.', 'error');
    }
}

// Post intent URL
function postToTwitter() {
    const text = tweetTextarea.value;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    closeComposer();
    showToast('Redirected to Twitter / X!', 'success');
}

// --- Toast System ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') {
        iconClass = 'fa-solid fa-circle-exclamation';
        toast.style.borderLeftColor = 'var(--color-deprecation)';
    } else if (type === 'info') {
        iconClass = 'fa-solid fa-circle-info';
        toast.style.borderLeftColor = 'var(--color-announcement)';
    }
    
    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove toast
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
