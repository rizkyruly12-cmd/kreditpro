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

        // Update count label
        const label = document.getElementById('notif-count-label');
        if (label) label.textContent = this.notifications.length + ' notifikasi';
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
        <div style="padding:14px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;">Jatuh Tempo</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:1px;">Angsuran mendekati batas waktu</div>
          </div>
          <button onclick="window.NotificationModule.closeDropdown()" style="background:none;border:none;color:#94a3b8;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:16px;" onmouseover="this.style.background='#f1f5f9';this.style.color='#475569'" onmouseout="this.style.background='none';this.style.color='#94a3b8'">✕</button>
        </div>
        <div id="notif-dropdown-content" style="overflow-y:auto;overflow-x:hidden;flex:1;padding:4px 12px;max-height:400px;pointer-events:all;-webkit-overflow-scrolling:touch;"></div>
        <div style="padding:10px 16px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;color:#94a3b8;" id="notif-count-label"></span>
          <button onclick="window.NotificationModule.clearAll()" style="background:none;border:none;color:#6366f1;cursor:pointer;font-size:11.5px;font-weight:600;padding:4px 8px;border-radius:6px;" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='none'">Hapus Semua</button>
        </div>
      `;
      
      document.body.appendChild(dropdown);
    },
    
    // Render dropdown content — minimal & clean
    renderDropdownContent() {
      const content = document.getElementById('notif-dropdown-content');
      if (!content) return;

      if (this.notifications.length === 0) {
        content.innerHTML = `
          <div style="padding:40px 20px;text-align:center;color:#94a3b8;">
            <svg width="36" height="36" style="margin:0 auto 10px;display:block;opacity:.4;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p style="margin:0;font-size:13px;">Tidak ada notifikasi</p>
          </div>`;
        return;
      }

      content.innerHTML = this.notifications.map(notif => {
        const date = new Date(notif.timestamp);
        const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        // Extract nama & barang dari pesan
        const namaMatch  = notif.message.match(/Kredit ([^(]+)\(/);
        const barangMatch = notif.message.match(/\(([^)]+)\)/);
        const nama   = namaMatch  ? namaMatch[1].trim()  : '';
        const barang = barangMatch ? barangMatch[1].trim() : '';

        // Ambil keterangan utama (angsuran / telat)
        const angsuranMatch = notif.message.match(/Angsuran: (Rp[\d.,]+)/);
        const angsuran = angsuranMatch ? angsuranMatch[1] : '';

        const isOverdue   = notif.type === 'OVERDUE';
        const isDueToday  = notif.type === 'DUE_TODAY' && notif.data?.daysUntilDue === 0;

        const accentColor = isOverdue ? '#dc2626' : isDueToday ? '#d97706' : '#6366f1';
        const dotColor    = isOverdue ? '#fca5a5' : isDueToday ? '#fde68a' : '#c7d2fe';

        return `
          <div style="display:flex;gap:12px;padding:12px 4px;border-bottom:1px solid #f1f5f9;">
            <!-- Dot indicator -->
            <div style="flex-shrink:0;padding-top:5px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${accentColor};"></div>
            </div>
            <!-- Content -->
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:2px;">
                <span style="font-size:13px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nama || notif.title}</span>
                <span style="font-size:10px;color:#94a3b8;flex-shrink:0;">${dateStr} ${timeStr}</span>
              </div>
              ${barang ? `<div style="font-size:11.5px;color:#64748b;margin-bottom:4px;">📦 ${barang}</div>` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:11px;color:${accentColor};font-weight:600;background:${accentColor}15;padding:2px 8px;border-radius:20px;">
                  ${isOverdue ? '⚠ Overdue' : isDueToday ? '● Hari Ini' : '○ 3 Hari Lagi'}
                </span>
                ${angsuran ? `<span style="font-size:11px;color:#475569;font-weight:600;">${angsuran}</span>` : ''}
              </div>
            </div>
          </div>`;
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
