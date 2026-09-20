# Notification System Documentation

## Overview
Sistem notifikasi profesional untuk Kredit Ruli yang menampilkan pelanggan yang jatuh tempo dan akan jatuh tempo dalam waktu dekat dengan detail lengkap.

## Features

### 1. Professional Dropdown UI ✅
- **Bell Icon dengan Badge Counter**: Menampilkan jumlah notifikasi yang belum dibaca
- **Dropdown Panel**: Menampilkan daftar lengkap notifikasi dengan kategori warna
- **Responsive Design**: Bekerja sempurna di desktop dan mobile
- **Smart Positioning**: Fixed di top-right, tidak tertutupi elemen lain

### 2. Notifikasi Real-time
Sistem otomatis mengirim notifikasi untuk:
- **H-3 Jatuh Tempo** (3 hari sebelum): Reminder awal
- **H+0 Jatuh Tempo** (hari ini): Alert penting
- **H+1 Overdue** (1 hari telat): Warning pembayaran terlambat

### 3. Detail Notifikasi
Setiap notifikasi menampilkan:
- Nama pelanggan
- Nama barang/item
- Status (reminder/due date/overdue)
- Tanggal & waktu notifikasi
- Ikon visual untuk kategori

### 4. Desktop Notifications (Browser API)
- Notifikasi sistem operasi jika browser tab tidak aktif
- Permission auto-request saat pertama kali
- Icon custom dengan brand color indigo

### 5. Persistent Storage
- Notifikasi disimpan di localStorage
- Maksimal 50 notifikasi tersimpan
- Otomatis cleanup jika melebihi limit

## Technical Architecture

### Module Structure
```javascript
// File: notifications.js
// IIFE Module (Immediately Invoked Function Expression)
// Auto-initializes saat DOM ready
// Exposes global: window.NotificationModule
```

### Core Methods
```javascript
NotificationModule.add(type, title, message, data)
  // Tambah notifikasi baru
  // type: 'DUE_TODAY', 'OVERDUE', 'WARNING'
  // Auto-save localStorage, trigger browser notification
  
NotificationModule.toggleDropdown()
  // Buka/tutup dropdown panel
  
NotificationModule.closeDropdown()
  // Tutup dropdown
  
NotificationModule.clearAll()
  // Hapus semua notifikasi
  
NotificationModule.updateBadge()
  // Update badge counter di bell icon
```

### Notification Types & Colors
| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| DUE_TODAY | ⏰ | Blue | 3 hari sebelum atau hari ini |
| DUE_TODAY | 📅 | Amber | Jatuh tempo hari ini |
| OVERDUE | ⚠️ | Red | Pembayaran telat |

## Integration with App

### 1. Auto-triggered Notifications
Dipanggil dari `checkDueDatesAndNotify()` di app.js:

```javascript
// Cek notifikasi setiap kali dashboard render
// Atau dipicu manual saat pembayaran/update data

const customers = getCustomers();
customers.forEach(c => {
  // Hitung tanggal jatuh tempo
  // Compare dengan today
  // Trigger notif sesuai kondisi
  
  NotificationModule.add(
    type, 
    title,
    message,
    { customerId, daysUntilDue }
  );
});
```

### 2. Manual Trigger
```javascript
// Bisa dipicu dari mana saja di app
NotificationModule.add(
  'DUE_TODAY',
  '⏰ Jatuh Tempo 3 Hari',
  'Kredit Budi (Sepeda Motor) akan jatuh tempo dalam 3 hari. Angsuran: Rp 1.200.000',
  { customerId: 1, daysUntilDue: 3 }
);
```

## UI Components

### Bell Icon (Topbar)
```html
<button id="notif-bell-btn" class="btn btn-outline btn-sm">
  <svg width="16" height="16"><use href="#ic-bell"/></svg>
  <span id="notif-badge">0</span>
</button>
```

### Dropdown Panel
- Dynamically created saat pertama kali dibuka
- Fixed positioning di top-right
- Scrollable jika notifikasi banyak
- Header dengan title dan close button
- Footer dengan "Hapus Semua" button

### Notification Item
```
┌─────────────────────────────────┐
│ ⏰ Jatuh Tempo 3 Hari           │
│ Kredit Budi (Sepeda Motor)...   │
│ akan jatuh tempo dalam 3 hari   │
│ Angsuran: Rp 1.200.000          │
│ 14:30                           │
└─────────────────────────────────┘
```

## Styling

### CSS Classes
- `.notif-badge`: Badge counter di bell icon
- `.notification-dropdown`: Main dropdown container
- `.notification-item`: Individual notification item
- `.notification-item-icon`: Icon area
- `.notification-item-content`: Text content

### Colors & Themes
```css
/* Blue - Warning/Reminder */
background: #f0f9ff;
border-left: 3px solid #0ea5e9;

/* Amber - Due Today */
background: #fef3c7;
border-left: 3px solid #d97706;

/* Red - Overdue */
background: #fef2f2;
border-left: 3px solid #dc2626;
```

## Testing

### Manual Testing
1. Buka `test-dropdown-notif.html` di browser
2. Klik "Tambah 5 Notifikasi Test"
3. Bell icon harus menunjukkan badge "5"
4. Klik bell untuk membuka dropdown
5. Verifikasi semua notifikasi tampil dengan benar

### Test Cases
```javascript
// Test 1: Add notifications
testAddNotifications()
  -> Harus tambah 5 notifikasi
  -> Badge harus menunjukkan 5
  -> Dropdown harus menampilkan 5 item

// Test 2: Overdue notification
testOverdueNotif()
  -> Background merah
  -> Icon ⚠️

// Test 3: Due today notification
testDueTodayNotif()
  -> Background amber/kuning
  -> Icon 📅

// Test 4: Clear all
testClearAll()
  -> Semua notifikasi hilang
  -> Badge hilang
  -> Dropdown kosong
```

## Browser Support
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance
- **File Size**: ~7KB (minified)
- **Memory**: <1MB typical usage
- **Storage**: ~50KB untuk 50 notifikasi di localStorage
- **No Dependencies**: Vanilla JavaScript

## Future Enhancements
1. **Sound Alerts**: Audio notification untuk alert penting
2. **Action Buttons**: Direct payment link dari notifikasi
3. **Filter/Sort**: Filter notifikasi by status/customer
4. **Dismissible**: Mark single notification as read
5. **Export**: Export notifikasi to PDF/CSV
6. **Mobile App**: Push notifications ke mobile app
7. **Email Integration**: Email notifikasi ke customer
8. **SMS Reminders**: Auto-SMS reminder jatuh tempo

## Troubleshooting

### Badge Tidak Muncul
```javascript
// Check if module initialized
console.log(window.NotificationModule)

// Manually update badge
window.NotificationModule.updateBadge()

// Check localStorage
console.log(localStorage.getItem('inAppNotifications'))
```

### Dropdown Tidak Bisa Dibuka
```javascript
// Check if button exists
console.log(document.getElementById('notif-bell-btn'))

// Check if module has openDropdown method
console.log(typeof window.NotificationModule.openDropdown)

// Force open
window.NotificationModule.openDropdown()
```

### Browser Notifications Tidak Muncul
```javascript
// Check permission status
console.log(Notification.permission)

// Request permission
Notification.requestPermission().then(perm => {
  console.log('Permission:', perm)
})
```

## Related Files
- `notifications.js` - Main module
- `app.js` - Integration & triggers (line 3624)
- `index.html` - Bell button UI
- `style.css` - Notification styling
- `test-dropdown-notif.html` - Testing page

## Changelog

### v2.0 (Current)
- ✅ Professional dropdown UI
- ✅ Real-time customer due dates
- ✅ Persistent storage
- ✅ Browser notifications
- ✅ Responsive design
- ✅ Auto-mark as read

### v1.0 (Previous)
- Simple alert() popup
- Badge counter only
