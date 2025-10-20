class InstantDownloader {
    constructor() {
        this.downloadQueue = [];
        this.activeDownloads = new Map();
        this.completedDownloads = [];
        this.failedDownloads = [];
        this.isDownloading = false;
        this.concurrency = 10;
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            speed: 0,
            startTime: null,
            totalSize: 0,
            downloadedSize: 0,
            lastUpdate: Date.now(),
            lastBytes: 0
        };

        this.initializeElements();
        this.attachEventListeners();
        this.loadSession();
        this.startStatsUpdate();
    }

    initializeElements() {
        // Input elements
        this.urlsTextarea = document.getElementById('urls');
        this.folderNameInput = document.getElementById('folderName');
        this.concurrentDownloadsSelect = document.getElementById('concurrentDownloads');
        this.autoRetrySelect = document.getElementById('autoRetry');
        this.timeoutSelect = document.getElementById('timeout');
        
        // Button elements
        this.downloadBtn = document.getElementById('downloadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.retryFailedBtn = document.getElementById('retryFailedBtn');
        this.exportListBtn = document.getElementById('exportListBtn');
        this.saveSessionBtn = document.getElementById('saveSessionBtn');
        
        // Progress elements
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        
        // Stats elements
        this.totalFilesEl = document.getElementById('totalFiles');
        this.completedFilesEl = document.getElementById('completedFiles');
        this.failedFilesEl = document.getElementById('failedFiles');
        this.activeDownloadsEl = document.getElementById('activeDownloads');
        this.speedStat = document.getElementById('speedStat');
        this.timeRemaining = document.getElementById('timeRemaining');
        this.successRate = document.getElementById('successRate');
        this.elapsedTime = document.getElementById('elapsedTime');
        
        // Downloads grid
        this.downloadsGrid = document.getElementById('downloadsGrid');
        this.emptyState = document.getElementById('emptyState');
        
        // Notification
        this.notification = document.getElementById('notification');
        this.notificationIcon = document.getElementById('notificationIcon');
        this.notificationText = document.getElementById('notificationText');
    }

    attachEventListeners() {
        this.downloadBtn.addEventListener('click', () => this.startInstantDownload());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.pauseBtn.addEventListener('click', () => this.pauseDownloads());
        this.resumeBtn.addEventListener('click', () => this.resumeDownloads());
        this.stopBtn.addEventListener('click', () => this.stopAll());
        this.retryFailedBtn.addEventListener('click', () => this.retryFailed());
        this.exportListBtn.addEventListener('click', () => this.exportList());
        this.saveSessionBtn.addEventListener('click', () => this.saveSession());

        // Auto-save when typing
        this.urlsTextarea.addEventListener('input', () => this.debounce(() => this.saveSession(), 1000));
        this.folderNameInput.addEventListener('input', () => this.debounce(() => this.saveSession(), 1000));
        
        // Update concurrency when changed
        this.concurrentDownloadsSelect.addEventListener('change', () => {
            this.concurrency = parseInt(this.concurrentDownloadsSelect.value);
            this.saveSession();
        });
    }

    async startInstantDownload() {
        const urls = this.getValidUrls();
        if (urls.length === 0) {
            this.showNotification('Please enter valid URLs', 'error');
            return;
        }

        this.stats.startTime = Date.now();
        this.stats.lastUpdate = Date.now();
        this.stats.lastBytes = 0;
        this.isDownloading = true;
        this.downloadBtn.disabled = true;
        this.concurrency = parseInt(this.concurrentDownloadsSelect.value);

        this.showNotification(`Starting ultra-fast download of ${urls.length} files with ${this.concurrency} parallel downloads...`, 'success');

        // Clear previous state but keep the queue
        this.completedDownloads = [];
        this.failedDownloads = [];
        this.activeDownloads.clear();
        this.downloadsGrid.innerHTML = '';
        this.emptyState.style.display = 'none';

        // Initialize download queue
        urls.forEach(url => {
            this.downloadQueue.push({
                url,
                fileName: this.generateFileName(url),
                status: 'pending',
                retries: 0,
                maxRetries: parseInt(this.autoRetrySelect.value),
                progress: 0,
                speed: 0,
                size: 0,
                downloaded: 0,
                startTime: null
            });
        });

        this.stats.total = urls.length;
        this.stats.completed = 0;
        this.stats.failed = 0;
        this.updateStats();

        // Start parallel downloads
        this.processDownloads();
    }

    async processDownloads() {
        while (this.isDownloading && (this.downloadQueue.length > 0 || this.activeDownloads.size > 0)) {
            const availableSlots = this.concurrency - this.activeDownloads.size;
            
            if (availableSlots > 0 && this.downloadQueue.length > 0) {
                const batch = this.downloadQueue.splice(0, availableSlots);
                batch.forEach(download => this.startSingleDownload(download));
            }

            // Update UI
            this.updateDownloadCards();
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.downloadQueue.length === 0 && this.activeDownloads.size === 0) {
            this.downloadComplete();
        }
    }

    async startSingleDownload(download) {
        download.status = 'downloading';
        download.startTime = Date.now();
        this.activeDownloads.set(download.url, download);

        try {
            // Use multiple CORS proxies simultaneously for maximum speed
            const content = await this.fetchUltraFast(download.url);
            await this.downloadFile(content, `${this.folderNameInput.value}/${download.fileName}`);
            
            download.status = 'success';
            download.progress = 100;
            this.completedDownloads.push(download);
            this.stats.completed++;
            
        } catch (error) {
            console.error(`Download failed: ${download.url}`, error);
            download.status = 'failed';
            download.error = error.message;
            this.failedDownloads.push(download);
            this.stats.failed++;
            
            // Auto-retry if enabled
            if (download.retries < download.maxRetries) {
                download.retries++;
                download.status = 'pending';
                this.downloadQueue.push(download);
                this.stats.failed--;
            }
        } finally {
            this.activeDownloads.delete(download.url);
            this.updateStats();
        }
    }

    async fetchUltraFast(url) {
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            `https://cors-anywhere.herokuapp.com/${url}`,
            url // Direct as last resort
        ];

        const timeout = parseInt(this.timeoutSelect.value) * 1000;
        
        // Create fetch promises for all proxies
        const promises = proxies.map(proxyUrl => 
            this.fetchWithTimeout(proxyUrl, timeout)
        );

        // Use Promise.any to get the first successful response
        try {
            const response = await Promise.any(promises);
            return response;
        } catch (error) {
            throw new Error(`All proxies failed for: ${url}`);
        }
    }

    async fetchWithTimeout(url, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const content = await response.text();
            if (!content || content.length === 0) {
                throw new Error('Empty response');
            }

            return content;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    downloadFile(content, filename) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([content], { type: 'application/octet-stream' });
            const blobUrl = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: blobUrl,
                filename: filename,
                saveAs: false,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                URL.revokeObjectURL(blobUrl);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        });
    }

    generateFileName(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            let path = urlObj.pathname;
            
            path = path.replace(/^\/+|\/+$/g, '');
            path = path.replace(/\//g, '_');
            
            const extension = this.getFileExtension(urlObj.pathname) || 'bin';
            let fileName = `${hostname}_${path}`;
            fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            
            if (fileName.length > 100) {
                const hash = this.simpleHash(url);
                fileName = `${hostname}_${hash}.${extension}`;
            }
            
            if (!fileName.endsWith(`.${extension}`)) {
                fileName += `.${extension}`;
            }
            
            return fileName;
        } catch (error) {
            return `file_${Date.now()}.bin`;
        }
    }

    getFileExtension(pathname) {
        const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return match ? match[1].toLowerCase() : null;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).slice(0, 8);
    }

    updateStats() {
        this.totalFilesEl.textContent = this.stats.total;
        this.completedFilesEl.textContent = this.stats.completed;
        this.failedFilesEl.textContent = this.stats.failed;
        this.activeDownloadsEl.textContent = this.activeDownloads.size;

        const progress = this.stats.total > 0 ? 
            ((this.stats.completed + this.stats.failed) / this.stats.total) * 100 : 0;
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${this.stats.completed + this.stats.failed}/${this.stats.total} files`;
        this.progressPercent.textContent = `${Math.round(progress)}%`;

        const successRate = this.stats.total > 0 ? 
            ((this.stats.completed / this.stats.total) * 100).toFixed(1) + '%' : '100%';
        this.successRate.textContent = successRate;
    }

    updateDownloadCards() {
        const allDownloads = [
            ...Array.from(this.activeDownloads.values()),
            ...this.completedDownloads.slice(-20),
            ...this.failedDownloads.slice(-10)
        ];

        if (allDownloads.length === 0) {
            this.emptyState.style.display = 'block';
            return;
        }

        this.emptyState.style.display = 'none';
        
        // Create a map of current cards for efficient updates
        const currentCards = new Map();
        this.downloadsGrid.querySelectorAll('.download-card').forEach(card => {
            const url = card.getAttribute('data-url');
            currentCards.set(url, card);
        });

        // Update or create cards
        allDownloads.forEach(download => {
            let card = currentCards.get(download.url);
            
            if (!card) {
                card = this.createDownloadCard(download);
                this.downloadsGrid.appendChild(card);
            } else {
                this.updateDownloadCard(card, download);
            }
        });

        // Remove old cards that are no longer relevant
        currentCards.forEach((card, url) => {
            if (!allDownloads.find(d => d.url === url)) {
                card.remove();
            }
        });
    }

    createDownloadCard(download) {
        const card = document.createElement('div');
        card.className = `download-card ${download.status}`;
        card.setAttribute('data-url', download.url);
        
        card.innerHTML = `
            <div class="download-header">
                <div class="download-filename" title="${download.fileName}">${download.fileName}</div>
                <div class="download-status status-${download.status}">
                    ${this.getStatusText(download.status)}
                </div>
            </div>
            <div class="download-url" title="${download.url}">${this.truncateUrl(download.url)}</div>
            <div class="download-progress">
                <div class="download-progress-fill" style="width: ${download.progress}%"></div>
            </div>
            <div class="download-speed">
                ${download.speed > 0 ? this.formatSpeed(download.speed) : ''}
                ${download.retries > 0 ? `Retry: ${download.retries}` : ''}
            </div>
        `;
        
        return card;
    }

    updateDownloadCard(card, download) {
        const statusEl = card.querySelector('.download-status');
        const progressFill = card.querySelector('.download-progress-fill');
        const speedEl = card.querySelector('.download-speed');
        
        card.className = `download-card ${download.status}`;
        statusEl.className = `download-status status-${download.status}`;
        statusEl.textContent = this.getStatusText(download.status);
        progressFill.style.width = `${download.progress}%`;
        
        speedEl.textContent = '';
        if (download.speed > 0) {
            speedEl.textContent += this.formatSpeed(download.speed);
        }
        if (download.retries > 0) {
            speedEl.textContent += speedEl.textContent ? ` | Retry: ${download.retries}` : `Retry: ${download.retries}`;
        }
        if (download.error) {
            speedEl.textContent += speedEl.textContent ? ` | Error: ${download.error}` : `Error: ${download.error}`;
        }
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'downloading': 'Downloading',
            'success': 'Success',
            'failed': 'Failed'
        };
        return statusMap[status] || status;
    }

    truncateUrl(url, maxLength = 50) {
        return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond < 1024) {
            return `${bytesPerSecond} B/s`;
        } else if (bytesPerSecond < 1024 * 1024) {
            return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        } else {
            return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
        }
    }

    startStatsUpdate() {
        setInterval(() => {
            this.updateLiveStats();
        }, 1000);
    }

    updateLiveStats() {
        // Update elapsed time
        if (this.stats.startTime) {
            const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.elapsedTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Calculate and update speed
            const now = Date.now();
            const timeDiff = (now - this.stats.lastUpdate) / 1000;
            if (timeDiff >= 1) {
                const bytesDiff = this.stats.downloadedSize - this.stats.lastBytes;
                this.stats.speed = bytesDiff / timeDiff;
                this.stats.lastUpdate = now;
                this.stats.lastBytes = this.stats.downloadedSize;
                
                this.speedStat.textContent = this.formatSpeed(this.stats.speed);
                
                // Update time remaining
                if (this.stats.speed > 0 && this.downloadQueue.length > 0) {
                    const remainingBytes = this.stats.totalSize - this.stats.downloadedSize;
                    const secondsRemaining = remainingBytes / this.stats.speed;
                    const minutesRemaining = Math.floor(secondsRemaining / 60);
                    const secondsRemainingFormatted = Math.floor(secondsRemaining % 60);
                    this.timeRemaining.textContent = `${minutesRemaining.toString().padStart(2, '0')}:${secondsRemainingFormatted.toString().padStart(2, '0')}`;
                } else {
                    this.timeRemaining.textContent = '--:--';
                }
            }
        }
    }

    downloadComplete() {
        this.isDownloading = false;
        this.downloadBtn.disabled = false;
        
        const message = `Download complete! ${this.stats.completed}/${this.stats.total} files successful.`;
        if (this.stats.failed > 0) {
            this.showNotification(`${message} ${this.stats.failed} files failed. Use "Retry Failed" to try again.`, 'warning');
        } else {
            this.showNotification(message, 'success');
        }
        
        // Generate failed downloads list if any failed
        if (this.stats.failed > 0) {
            this.generateFailedList();
        }
    }

    generateFailedList() {
        if (this.failedDownloads.length === 0) return;
        
        const failedContent = this.failedDownloads.map(download => 
            `${download.url} | Error: ${download.error}`
        ).join('\n');
        
        const blob = new Blob([failedContent], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: blobUrl,
            filename: `${this.folderNameInput.value}/_FAILED_DOWNLOADS.txt`,
            saveAs: false
        }, () => {
            URL.revokeObjectURL(blobUrl);
        });
    }

    pauseDownloads() {
        this.isDownloading = false;
        this.showNotification('Downloads paused', 'warning');
    }

    resumeDownloads() {
        if (!this.isDownloading && (this.downloadQueue.length > 0 || this.activeDownloads.size > 0)) {
            this.isDownloading = true;
            this.processDownloads();
            this.showNotification('Downloads resumed', 'success');
        }
    }

    stopAll() {
        this.isDownloading = false;
        this.downloadQueue = [];
        this.activeDownloads.clear();
        this.downloadBtn.disabled = false;
        this.showNotification('All downloads stopped', 'error');
    }

    retryFailed() {
        if (this.failedDownloads.length === 0) {
            this.showNotification('No failed downloads to retry', 'warning');
            return;
        }

        // Move failed downloads back to queue
        this.failedDownloads.forEach(download => {
            download.status = 'pending';
            download.retries = 0;
            download.error = null;
            this.downloadQueue.push(download);
        });

        this.failedDownloads = [];
        this.stats.failed = 0;
        
        if (!this.isDownloading) {
            this.isDownloading = true;
            this.processDownloads();
        }

        this.showNotification(`Retrying ${this.downloadQueue.length} failed downloads`, 'success');
    }

    clearAll() {
        this.stopAll();
        this.urlsTextarea.value = '';
        this.downloadsGrid.innerHTML = '';
        this.emptyState.style.display = 'block';
        this.stats = { 
            total: 0, 
            completed: 0, 
            failed: 0, 
            speed: 0, 
            startTime: null, 
            totalSize: 0, 
            downloadedSize: 0,
            lastUpdate: Date.now(),
            lastBytes: 0
        };
        this.downloadQueue = [];
        this.completedDownloads = [];
        this.failedDownloads = [];
        this.updateStats();
        this.showNotification('All cleared', 'success');
    }

    exportList() {
        const allUrls = this.getValidUrls();
        if (allUrls.length === 0) {
            this.showNotification('No URLs to export', 'warning');
            return;
        }

        const content = allUrls.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: blobUrl,
            filename: 'exported_urls.txt',
            saveAs: true
        }, () => {
            URL.revokeObjectURL(blobUrl);
        });
        
        this.showNotification('URL list exported', 'success');
    }

    saveSession() {
        const session = {
            urls: this.urlsTextarea.value,
            folderName: this.folderNameInput.value,
            concurrency: this.concurrentDownloadsSelect.value,
            autoRetry: this.autoRetrySelect.value,
            timeout: this.timeoutSelect.value
        };
        chrome.storage.local.set({ instantDownloaderSession: session });
    }

    loadSession() {
        chrome.storage.local.get(['instantDownloaderSession'], (result) => {
            if (result.instantDownloaderSession) {
                const session = result.instantDownloaderSession;
                this.urlsTextarea.value = session.urls || '';
                this.folderNameInput.value = session.folderName || 'instant-downloads';
                this.concurrentDownloadsSelect.value = session.concurrency || '10';
                this.autoRetrySelect.value = session.autoRetry || '2';
                this.timeoutSelect.value = session.timeout || '10';
            }
        });
    }

    getValidUrls() {
        return this.urlsTextarea.value.split('\n')
            .map(url => url.trim())
            .filter(url => {
                if (url.length === 0) return false;
                try {
                    new URL(url);
                    return true;
                } catch {
                    return false;
                }
            });
    }

    showNotification(message, type = 'info') {
        this.notification.className = `notification ${type} show`;
        this.notificationText.textContent = message;
        
        const iconMap = {
            'success': 'check_circle',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        this.notificationIcon.textContent = iconMap[type] || 'info';
        
        setTimeout(() => {
            this.notification.classList.remove('show');
        }, 4000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the downloader when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InstantDownloader();
});