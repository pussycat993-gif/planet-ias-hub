# IAS Hub — PCI Integration Guide

## Overview

This folder contains the Laravel code that needs to be added to **PLANet Contact IAS** to enable IAS Hub integration.

## Files

| File | Destination in PCI repo |
|---|---|
| `routes.php` | Add contents to `routes/web.php` or `routes/api.php` |
| `IASConnectController.php` | `app/Http/Controllers/Api/IASConnectController.php` |
| `IASHubAuth.php` | `app/Http/Middleware/IASHubAuth.php` |

## Setup Steps

### 1. Copy controller
```bash
cp IASConnectController.php /var/www/planet-contact-ias/app/Http/Controllers/Api/
```

### 2. Copy middleware
```bash
cp IASHubAuth.php /var/www/planet-contact-ias/app/Http/Middleware/
```

### 3. Register middleware in Kernel.php
```php
// app/Http/Kernel.php
protected $routeMiddleware = [
    // ... existing middleware
    'ias.hub.auth' => \App\Http\Middleware\IASHubAuth::class,
];
```

### 4. Add routes to routes/web.php
Copy the contents of `routes.php` into the PCI routes file.

### 5. Add config values to PCI .env
```env
IAS_HUB_JWT_SECRET=same_value_as_ias_hub_JWT_SECRET
IAS_HUB_URL=http://your-ias-hub-server:3001
```

### 6. Add to PCI config/app.php
```php
'ias_hub_jwt_secret' => env('IAS_HUB_JWT_SECRET'),
'ias_hub_url'        => env('IAS_HUB_URL'),
```

### 7. Install JWT library (if not present)
```bash
composer require firebase/php-jwt
```

### 8. Clear cache
```bash
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

## PCI UI Additions (separate task)

Add these buttons to PCI Blade templates:

### People detail page
```blade
{{-- In resources/views/people/detail.blade.php --}}
<a href="javascript:void(0)"
   onclick="window.location.href='iashub://dm?pci_person_id={{ $person->z_IAS_KEY }}'"
   class="btn btn-sm">
   💬 Message
</a>
<a href="javascript:void(0)"
   onclick="window.location.href='iashub://call?pci_person_id={{ $person->z_IAS_KEY }}&type=audio'"
   class="btn btn-sm">
   📞 Call
</a>
```

### Activity form — Meeting type
```blade
{{-- In activity create/edit form --}}
@if($activity->Activity_Type === 'Meeting')
<div class="form-group">
    <label>IAS Hub Channel</label>
    <select name="ias_hub_channel_id">
        <option value="">-- None --</option>
        {{-- Populated via AJAX from IAS Hub API --}}
    </select>
</div>
@endif
```

## Testing the Integration

```bash
# Test auth/verify endpoint
curl -X POST https://ias-app.planetsg.com/api/ias-connect/auth/verify \
  -H "Authorization: Bearer YOUR_JWT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGci..."}'

# Test contact endpoint
curl https://ias-app.planetsg.com/api/ias-connect/contact/102 \
  -H "Authorization: Bearer YOUR_JWT_SECRET"

# Test activity log
curl -X POST https://ias-app.planetsg.com/api/ias-connect/activity-log \
  -H "Authorization: Bearer YOUR_JWT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_type": "Video Call",
    "Activity_Subject": "Test call from IAS Hub",
    "Activity_DateTime": "2026-04-15T10:00:00Z",
    "Duration": 30,
    "Status": "Complete",
    "People": [102],
    "Entities": []
  }'
```
