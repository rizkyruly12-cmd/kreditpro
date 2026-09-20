/**
 * NOTIFICATIONS MODULE - Professional Dropdown
 * Shows customer due dates & payment reminders in a dropdown panel
 */

(function() {
  'use strict';
  
  const NotificationModule = {
    notifications: [],
    isDropdownOpen: false,
    
    // Initialize
    init() {
      this.loadFromStorage();
      this.updateBadge();
      this.setupBellButton();
      // setupClickOutside handled via document.addEventListener below
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
        this.toggleDropdown();
      });
    },
    
    // Toggle dropdown visibility
    toggleDropdown() {
      if (this.isDropdownOpen) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    },
    
    // Open dropdown
    openDropdown() {
      const dropdown = document.getElementById('notification-dropdown');
      if (!dropdown) {
        this.createDropdown();
      }
      
      const dd = document.getElementById('notification-dropdown');
      if (dd) {
        dd.style.display = 'flex';
        this.isDropdownOpen = true;
        
        // Mark all as read
        this.notifications.forEach(n => n.read = true);
        this.saveToStorage();
        this.updateBadge();
        
        // Render notifications
        this.renderDropdownContent();
      }
    },
    
    // Close dropdown
    closeDropdown() {
      const dd = document.getElementById('notification-dropdown');
      if (dd) {
        dd.style.display = 'none';
        this.isDropdownOpen = false;
      }
    },
    
    // Create dropdown HTML
    createDropdown() {
      const bellBtn = document.getElementById('notif-bell-btn');
      if (!bellBtn) return;
      
      const dropdown = document.createElement('div');
      dropdown.id = 'notification-dropdown';
      dropdown.style.cssText = `
        position: fixed;
        top: 60px;
        right: 16px;
        width: 380px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        z-index: 99999;
        display: none;
        flex-direction: column;
        max-height: 520px;
        overflow: hidden;
        pointer-events: all;
      `;
      
      dropdown.innerHTML = `
        <div style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px 8px 0 0; flex-shrink: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">Notifikasi Jatuh Tempo</h3>
            <button onclick="window.NotificationModule.closeDropdown()" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 20px; padding: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 4px; pointer-events: all;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">✕</button>
          </div>
        </div>
        <div id="notif-dropdown-content" style="overflow-y: auto; overflow-x: hidden; flex: 1; padding: 8px; max-height: 400px; pointer-events: all; -webkit-overflow-scrolling: touch;"></div>
        <div style="padding: 10px; border-top: 1px solid #e2e8f0; text-align: center; flex-shrink: 0; border-radius: 0 0 8px 8px; background: #fafafa;">
          <button onclick="window.NotificationModule.clearAll()" style="background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; text-decoration: underline; pointer-events: all;">Hapus Semua</button>
        </div>
      `;
      
      document.body.appendChild(dropdown);
    },
    
    // Render dropdown content - IMPROVED WITH CLEAR CUSTOMER NAMES
    renderDropdownContent() {
      const content = document.getElementById('notif-dropdown-content');
      if (!content) return;
      
      if (this.notifications.length === 0) {
        content.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
            <svg width="40" height="40" style="margin: 0 auto 12px; opacity: 0.5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p style="margin: 0; font-size: 13px;">Tidak ada notifikasi</p>
          </div>
        `;
        return;
      }
      
      content.innerHTML = this.notifications.map((notif, idx) => {
        const date = new Date(notif.timestamp);
        const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
        
        let bgColor = '#f0f9ff'; // blue
        let borderColor = '#0ea5e9';
        let icon = '⏰';
        let statusLabel = '';
        let statusColor = '#0891b2';
        
        if (notif.type === 'OVERDUE') {
          bgColor = '#fef2f2';
          borderColor = '#dc2626';
          icon = '⚠️';
          statusLabel = '⚠️ OVERDUE';
          statusColor = '#dc2626';
        } else if (notif.type === 'DUE_TODAY') {
          bgColor = '#fef3c7';
          borderColor = '#d97706';
          icon = '📅';
          statusLabel = '📅 JATUH TEMPO HARI INI';
          statusColor = '#d97706';
        } else {
          statusLabel = '⏰ JATUH TEMPO DEKAT';
          statusColor = '#0891b2';
        }
        
        // Parse message untuk extract nama pelanggan
        const namaPelangganMatch = notif.message.match(/Kredit ([^(]+)/);
        const namaPelanggan = namaPelangganMatch ? namaPelangganMatch[1].trim() : 'Pelanggan';
        
        const barangMatch = notif.message.match(/\(([^)]+)\)/);
        const barang = barangMatch ? barangMatch[1] : '';
        
        return `
          <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 14px; margin-bottom: 10px; border-radius: 6px; font-size: 13px;">
            <div style="display: flex; gap: 10px;">
              <!-- Icon -->
              <div style="font-size: 24px; flex-shrink: 0; padding-top: 2px;">
                ${icon}
              </div>
              <!-- Content -->
              <div style="flex: 1; min-width: 0;">
                <!-- Status Badge -->
                <div style="display: inline-block; background: ${statusColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; margin-bottom: 6px;">
                  ${statusLabel}
                </div>
                
                <!-- NAMA PELANGGAN - BESAR & JELAS -->
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px; word-break: break-word;">
                  ${namaPelanggan}
                </div>
                
                <!-- BARANG -->
                ${barang ? `<div style="font-size: 12px; color: #475569; margin-bottom: 6px; font-weight: 500;">📦 ${barang}</div>` : ''}
                
                <!-- MESSAGE -->
                <div style="color: #64748b; margin-bottom: 6px; line-height: 1.5; font-size: 12px;">
                  ${notif.message}
                </div>
                
                <!-- TIMESTAMP -->
                <div style="font-size: 10px; color: #94a3b8; text-align: right; margin-top: 6px;">
                  ${dateStr} • ${timeStr}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    },
    
    // Clear all
    clearAll() {
      this.notifications = [];
      this.saveToStorage();
      this.updateBadge();
      this.renderDropdownContent();
    }
  };
  
  // Expose globally
  window.NotificationModule = NotificationModule;
  
  // Close dropdown when click outside
  document.addEventListener('click', (e) => {
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notification-dropdown');
    
    if (bellBtn && dropdown && !bellBtn.contains(e.target) && !dropdown.contains(e.target)) {
      if (window.NotificationModule.isDropdownOpen) {
        window.NotificationModule.closeDropdown();
      }
    }
  });
  
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
