/**
 * NOTIFICATIONS MODULE - Standalone & Isolated
 * Self-contained notification system that doesn't depend on app.js timing
 */

(function() {
  'use strict';
  
  // Module state
  const NotificationModule = {
    notifications: [],
    
    // Initialize on script load (not waiting for DOMContentLoaded)
    init() {
      this.loadFromStorage();
      this.setupEventListeners();
      this.updateUI();
      console.log('✓ Notification module initialized');
    },
    
    // Load from localStorage
    loadFromStorage() {
      try {
        const stored = localStorage.getItem('inAppNotifications');
        this.notifications = stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.warn('Failed to load notifications from storage:', e);
        this.notifications = [];
      }
    },
    
    // Save to localStorage
    saveToStorage() {
      try {
        localStorage.setItem('inAppNotifications', JSON.stringify(this.notifications));
      } catch (e) {
        console.warn('Failed to save notifications:', e);
      }
    },
    
    // Add notification
    add(type, title, message, data = {}) {
      const notif = {
        id: Date.now(),
        type,
        title,
        message,
        timestamp: new Date().toISOString(),
        read: false,
        data
      };
      
      this.notifications.unshift(notif);
      if (this.notifications.length > 50) {
        this.notifications.pop();
      }
      
      this.saveToStorage();
      this.updateUI();
      
      return notif;
    },
    
    // Clear all
    clearAll() {
      this.notifications = [];
      this.saveToStorage();
      this.updateUI();
    },
    
    // Format relative time
    timeAgo(date) {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      if (seconds < 60) return 'Baru saja';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm yang lalu';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h yang lalu';
      return new Date(date).toLocaleDateString('id-ID');
    },
    
    // Update UI (badge + list)
    updateUI() {
      this.updateBadge();
      this.renderList();
    },
    
    // Update badge
    updateBadge() {
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      
      const unread = this.notifications.filter(n => !n.read).length;
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    },
    
    // Render list
    renderList() {
      const list = document.getElementById('notification-list');
      if (!list) return;
      
      if (this.notifications.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Tidak ada notifikasi</div>';
        return;
      }
      
      list.innerHTML = this.notifications.map(n => {
        const iconMap = {
          'warning': { icon: '⏰', class: 'warning' },
          'alert': { icon: '⚠️', class: 'alert' },
          'success': { icon: '✓', class: 'success' },
          'info': { icon: 'ℹ️', class: 'info' }
        };
        
        const iconData = iconMap[n.type] || iconMap['info'];
        
        return `
          <div class="notification-item" onclick="NotificationModule.markRead(${n.id})">
            <div class="notification-item-icon ${iconData.class}">${iconData.icon}</div>
            <div class="notification-item-content">
              <div class="notification-item-title">${n.title}</div>
              <div class="notification-item-message">${n.message}</div>
              <div class="notification-item-time">${this.timeAgo(n.timestamp)}</div>
            </div>
            ${!n.read ? '<div class="notification-item-unread"></div>' : ''}
          </div>
        `;
      }).join('');
    },
    
    // Mark as read
    markRead(id) {
      const notif = this.notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        this.saveToStorage();
        this.updateUI();
      }
    },
    
    // Setup event listeners
    setupEventListeners() {
      // Toggle dropdown
      const btn = document.getElementById('notif-bell-btn');
      if (btn) {
        btn.addEventListener('click', () => this.toggle());
      }
      
      // Close on outside click
      document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notification-dropdown');
        const btn = document.getElementById('notif-bell-btn');
        
        if (dropdown && btn) {
          if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        }
      });
    },
    
    // Toggle dropdown
    toggle() {
      const dropdown = document.getElementById('notification-dropdown');
      if (!dropdown) return;
      
      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
      
      if (!isOpen) {
        // Mark all as read when opened
        this.notifications.forEach(n => n.read = true);
        this.saveToStorage();
        this.updateUI();
      }
    }
  };
  
  // Expose globally
  window.NotificationModule = NotificationModule;
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationModule.init());
  } else {
    NotificationModule.init();
  }
})();
