/**
 * NOTIFICATIONS MODULE - Simple Badge Counter
 * Lightweight notification system that shows badge count on bell icon
 */

(function() {
  'use strict';
  
  const NotificationModule = {
    notifications: [],
    
    // Initialize
    init() {
      this.loadFromStorage();
      this.updateBadge();
      this.setupBellButton();
      console.log('✓ Notification module initialized');
    },
    
    // Load from storage
    loadFromStorage() {
      try {
        const stored = localStorage.getItem('inAppNotifications');
        this.notifications = stored ? JSON.parse(stored) : [];
      } catch (e) {
        this.notifications = [];
      }
    },
    
    // Save to storage
    saveToStorage() {
      try {
        localStorage.setItem('inAppNotifications', JSON.stringify(this.notifications));
      } catch (e) {
        console.warn('Failed to save');
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
      if (this.notifications.length > 50) this.notifications.pop();
      
      this.saveToStorage();
      this.updateBadge();
      
      // Also show browser notification
      this.showBrowserNotification(title, message);
      
      return notif;
    },
    
    // Show browser notification
    showBrowserNotification(title, message) {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%236366f1"/></svg>'
          });
        } catch (e) {
          console.warn('Notification failed:', e);
        }
      }
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
    
    // Setup bell button click
    setupBellButton() {
      const btn = document.getElementById('notif-bell-btn');
      if (!btn) return;
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showNotificationList();
      });
    },
    
    // Show notification list (simple alert for now)
    showNotificationList() {
      if (this.notifications.length === 0) {
        alert('Tidak ada notifikasi');
        return;
      }
      
      // Mark all as read
      this.notifications.forEach(n => n.read = true);
      this.saveToStorage();
      this.updateBadge();
      
      // Show list
      let message = 'Notifikasi:\n\n';
      this.notifications.slice(0, 5).forEach((n, i) => {
        message += `${i + 1}. ${n.title}\n   ${n.message}\n\n`;
      });
      
      if (this.notifications.length > 5) {
        message += `... dan ${this.notifications.length - 5} notifikasi lainnya`;
      }
      
      alert(message);
    },
    
    // Clear all
    clearAll() {
      this.notifications = [];
      this.saveToStorage();
      this.updateBadge();
    }
  };
  
  // Expose globally
  window.NotificationModule = NotificationModule;
  
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationModule.init());
  } else {
    NotificationModule.init();
  }
})();
