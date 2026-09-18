# Test Checklist - In-App Notification Center

## Feature Overview
- Icon bell dengan badge counter di topbar
- Dropdown notification list
- Auto-notifications untuk jatuh tempo (H-3, H+0, H+1)
- Timestamp dan notification types (warning, alert, success, info)
- Mark as read & clear all functionality

---

## Test Cases

### 1. UI Components
- [ ] **Icon Bell Visible**: Bell icon muncul di topbar kanan (sebelum "Bayar" button)
- [ ] **Badge Position**: Red badge di sudut kanan atas bell icon
- [ ] **Responsive**: Bell icon responsive di mobile/tablet/desktop
- [ ] **Styling**: Professional look dengan shadow, border, warna indigo theme

### 2. Notification Center Opening/Closing
- [ ] **Click Bell**: Klik bell icon → dropdown muncul di bawah
- [ ] **Close Onclick Outside**: Klik di luar dropdown → dropdown tertutup
- [ ] **Toggle**: Klik bell 2x → dropdown toggle on/off
- [ ] **Smooth Animation**: Dropdown muncul/hilang smooth (no jarring)
- [ ] **Position**: Dropdown aligned ke kanan button

### 3. Badge Counter
- [ ] **Badge Hidden**: Jika tidak ada notifikasi → badge tidak terlihat
- [ ] **Badge Count**: Jika ada 3 notifikasi unread → badge show "3"
- [ ] **Max Badge**: Jika ada 10+ notifikasi → badge show "9+"
- [ ] **Badge Update**: Saat buka dropdown → badge hilang (sudah read)
- [ ] **New Notif**: Saat ada notifikasi baru → badge muncul lagi

### 4. Notification List Display
- [ ] **Empty State**: Jika tidak ada notif → tampil "Tidak ada notifikasi"
- [ ] **List Render**: Notifikasi tampil di dropdown list
- [ ] **Latest First**: Notifikasi terbaru di atas
- [ ] **Max 50**: System simpan max 50 notifikasi (older deleted)
- [ ] **Scrollable**: Jika > 5 notif → dropdown scrollable

### 5. Notification Display
- [ ] **Icon**: Notification icon sesuai type (⏰ warning, ⚠️ alert, ✓ success)
- [ ] **Title**: Title notifikasi muncul (e.g., "⏰ Jatuh Tempo 3 Hari")
- [ ] **Message**: Detail message muncul dengan nama pelanggan, barang
- [ ] **Timestamp**: Waktu muncul (e.g., "Baru saja", "5m yang lalu", "2h yang lalu")
- [ ] **Color Coding**: Warning = kuning, Alert = merah, Success = hijau
- [ ] **Unread Indicator**: Dot indicator untuk notifikasi unread

### 6. Auto-Notifications (Due Dates)
- [ ] **H-3 Notification**: 3 hari sebelum jatuh tempo → warning notif muncul
  - Title: "⏰ Jatuh Tempo 3 Hari"
  - Message: Nama pelanggan + barang + angsuran
  - Type: warning (yellow background)

- [ ] **H+0 Notification**: Hari jatuh tempo → alert notif muncul
  - Title: "📌 Jatuh Tempo Hari Ini"
  - Message: Nama pelanggan + barang
  - Type: alert (red background)

- [ ] **H+1 Notification**: 1 hari setelah jatuh tempo → alert notif muncul
  - Title: "⚠️ Overdue 1 Hari"
  - Message: Nama pelanggan + barang + "TELAT"
  - Type: alert (red background)

- [ ] **Auto-Check**: Notifications check setiap 5 menit
- [ ] **Multiple Customers**: Jika 3 customer jatuh tempo, muncul 3 notif
- [ ] **No Duplicate**: Notifikasi tidak duplicate untuk customer yang sama

### 7. Interaction
- [ ] **Click Notif**: Klik notifikasi → marked as read (dot indicator hilang)
- [ ] **Clear All**: Klik "Bersihkan Semua" → semua notifikasi dihapus
- [ ] **Confirm Clear**: Toast muncul "Semua notifikasi dihapus"
- [ ] **Open Dropdown**: Saat buka dropdown → semua notif auto-marked read

### 8. Desktop Notification Integration
- [ ] **Permission Request**: Pertama kali load → browser minta notif permission
- [ ] **Desktop Popup**: Notifikasi juga appear sebagai browser desktop notification
- [ ] **Both Active**: In-app + desktop notifications both work together
- [ ] **Same Content**: Content in-app = desktop notification

### 9. Data Persistence
- [ ] **LocalStorage**: Notifikasi disimpan di localStorage
- [ ] **Survive Refresh**: Refresh browser → notifikasi masih ada
- [ ] **Survive Close**: Close tab → open kembali → notifikasi masih ada
- [ ] **Clear on Clear All**: Clear all → localStorage juga cleared

### 10. Activity Log Integration
- [ ] **Log Recorded**: Setiap notifikasi tercatat di Activity Log
- [ ] **Action Type**: Action logged sebagai "NOTIFICATION"
- [ ] **Entity Type**: Entity type = "customer"
- [ ] **Reason Field**: Detail reason ada (due_in_3_days, due_today, overdue_1_day)

### 11. Performance
- [ ] **Load Time**: Topbar load time tetap < 1 detik (bell icon tidak lag)
- [ ] **Dropdown Open**: Dropdown open smooth (< 200ms)
- [ ] **List Render**: 50 notifikasi render instant (< 500ms)
- [ ] **No Memory Leak**: Open/close dropdown 10x → no lag/freeze
- [ ] **Notification Check**: 5min auto-check tidak impact performance

### 12. Edge Cases
- [ ] **No Customers**: Jika tidak ada customer → no error
- [ ] **No Due Dates**: Jika semua customer belum jatuh tempo → empty state ok
- [ ] **Timezone**: Jika server timezone berbeda → still work correctly
- [ ] **Multiple Tabs**: Open 2 tab → notifikasi sync (localStorage listener)
- [ ] **Mobile**: Bell icon visible & functional di mobile (small screen)

### 13. Accessibility
- [ ] **Keyboard**: Tab key dapat navigate ke bell button
- [ ] **Hover**: Hover notification item → highlight background change
- [ ] **Color Contrast**: Text legible pada semua notification types
- [ ] **Responsive**: Dropdown width responsive di mobile (tidak overflow)

---

## Test Scenarios

### Scenario 1: New Notification Workflow
```
1. Login ke dashboard
2. Observe: Bell icon ada, badge tidak muncul (0 notif)
3. Create pelanggan baru dengan tgl jatuh tempo H+3
4. Wait 5 menit (atau trigger checkDueDatesAndNotify manually)
5. Observe: Bell badge muncul dengan angka "1"
6. Click bell → dropdown open
7. Observe: Warning notifikasi muncul dengan title "⏰ Jatuh Tempo 3 Hari"
8. Click notifikasi → marked read (dot hilang)
9. Badge masih show "1" (still 1 unread)
10. Close dropdown → buka lagi → badge hilang (semua read saat open)
```

### Scenario 2: Multiple Notifications
```
1. Create 3 pelanggan dengan different due dates
2. Trigger auto-check
3. Observe: Bell badge show "3"
4. Click bell → 3 notifications tampil
5. Each dengan different type (H-3 = warning, H+0 = alert, H+1 = alert)
6. Verify warna icon berbeda per type
7. Verify message content berbeda per customer
8. Click "Bersihkan Semua"
9. Observe: All notifications gone, badge hidden
```

### Scenario 3: Auto-Check Timing
```
1. Create pelanggan jatuh tempo tomorrow (H+1)
2. Open DevTools Console
3. Trigger: checkDueDatesAndNotify()
4. Observe: Warning notif muncul in-app + desktop
5. Check Activity Log → NOTIFICATION logged
6. Wait 5 menit → check auto-check jalan
7. Verify no duplicate notifikasi
```

### Scenario 4: Persistence
```
1. Add 5 notifikasi ke dropdown
2. Refresh browser (F5)
3. Observe: Notifikasi masih ada (localStorage load)
4. Close tab completely
5. Open tab kembali
6. Observe: Notifikasi masih ada
7. Clear All notifikasi
8. Refresh
9. Observe: Dropdown empty (localStorage cleared)
```

---

## Browser Console Test Commands

```javascript
// Manually add test notification
addNotification('warning', 'Test Warning', 'Ini adalah test warning notification', {});

// Manually add alert
addNotification('alert', 'Test Alert', 'Ini adalah test alert notification!', {});

// Manually add success
addNotification('success', 'Test Success', 'Ini adalah test success notification!', {});

// Check notification count
console.log('Total notifications:', notifications.length);
console.log('Unread count:', notifications.filter(n => !n.read).length);

// Check localStorage
console.log('Stored notifications:', JSON.parse(localStorage.getItem('inAppNotifications')));

// Force check due dates
checkDueDatesAndNotify();

// Clear all (same as UI button)
clearAllNotifications();
```

---

## Expected Behavior Summary

| Action | Expected Result |
|--------|-----------------|
| **Load Page** | Bell icon visible, badge hidden (0 notif) |
| **New Notif** | Badge show count, bell highlight |
| **Click Bell** | Dropdown open, all marked read, badge hidden |
| **Click Notif** | Mark as read, dot disappear |
| **Clear All** | All notif gone, localStorage cleared |
| **Refresh Page** | Notif restored from localStorage |
| **Due Date H-3** | Warning notif (yellow) appears |
| **Due Date H+0** | Alert notif (red) appears |
| **Due Date H+1** | Alert notif (red) "TELAT" appears |

---

## Passing Criteria
- ✅ All UI components display correctly
- ✅ Badge counter works accurately
- ✅ Dropdown opens/closes properly
- ✅ Auto-notifications trigger at correct times
- ✅ Notifications persist in localStorage
- ✅ No console errors
- ✅ Mobile responsive
- ✅ Performance acceptable (no lag)

