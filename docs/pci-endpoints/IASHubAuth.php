<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * IASHubAuth Middleware
 *
 * Validates that requests from IAS Hub contain the correct JWT_SECRET.
 * Add to: app/Http/Middleware/IASHubAuth.php
 * Register in: app/Http/Kernel.php → $routeMiddleware['ias.hub.auth']
 */
class IASHubAuth
{
    public function handle(Request $request, Closure $next)
    {
        $authHeader = $request->header('Authorization');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $token = substr($authHeader, 7);
        $expected = config('app.ias_hub_jwt_secret');

        // For webhook endpoints, validate against shared JWT secret directly
        if ($token !== $expected) {
            return response()->json(['error' => 'Invalid IAS Hub token'], 401);
        }

        return $next($request);
    }
}
