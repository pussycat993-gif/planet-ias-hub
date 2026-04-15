<?php
// ═══════════════════════════════════════════════════════════════
// IAS Hub — PCI Laravel Endpoints
// Add these routes to: routes/web.php or routes/api.php in PLANet Contact IAS
// Prefix all with: /api/ias-connect
// Middleware: ias.hub.auth (validates JWT_SECRET header)
// ═══════════════════════════════════════════════════════════════

use App\Http\Controllers\Api\IASConnectController;

Route::prefix('api/ias-connect')->middleware('ias.hub.auth')->group(function () {

    // Auth
    Route::post('/auth/verify',             [IASConnectController::class, 'verifyToken']);

    // Users
    Route::get('/users',                    [IASConnectController::class, 'getUsers']);

    // Contact context (right panel)
    Route::get('/contact/{id}',             [IASConnectController::class, 'getContact']);

    // Presence
    Route::post('/presence/{userId}',       [IASConnectController::class, 'updatePresence']);

    // Activity logging
    Route::post('/activity-log',            [IASConnectController::class, 'logActivity']);

    // Scheduled meetings (IAS Hub → PCI pushes, PCI → IAS Hub via IAS Hub API)
    Route::post('/scheduled-meeting',       [IASConnectController::class, 'createScheduledMeeting']);
    Route::delete('/scheduled-meeting/{id}',[IASConnectController::class, 'cancelScheduledMeeting']);

    // DWM workflow action (approve/reject from IAS Hub)
    Route::post('/dwm-action',              [IASConnectController::class, 'handleDWMAction']);
});
