<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * IASConnectController
 *
 * Handles all IAS Hub ↔ PLANet Contact IAS API endpoints.
 * Add this file to: app/Http/Controllers/Api/IASConnectController.php
 */
class IASConnectController extends Controller
{
    // ── POST /api/ias-connect/auth/verify ────────────────────
    public function verifyToken(Request $request)
    {
        $token = $request->input('token');

        try {
            $payload = \Firebase\JWT\JWT::decode(
                $token,
                new \Firebase\JWT\Key(config('app.ias_hub_jwt_secret'), 'HS256')
            );

            // Find user in PCI
            $user = DB::table('xx_user')->where('email', $payload->email)->first();

            if (!$user) {
                return response()->json(['valid' => false, 'error' => 'User not found'], 401);
            }

            return response()->json([
                'valid' => true,
                'user'  => [
                    'id'    => $user->z_IAS_ID,
                    'name'  => $user->name ?? ($user->first_name . ' ' . $user->last_name),
                    'email' => $user->email,
                    'role'  => $user->role ?? 'member',
                    'avatar'=> null, // add avatar URL if available
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['valid' => false, 'error' => 'Invalid token'], 401);
        }
    }

    // ── GET /api/ias-connect/users ────────────────────────────
    public function getUsers(Request $request)
    {
        $users = DB::table('xx_user')
            ->where('Active', 1)
            ->select('z_IAS_ID as id', 'email', 'first_name', 'last_name', 'role')
            ->get()
            ->map(fn($u) => [
                'id'    => $u->id,
                'name'  => trim($u->first_name . ' ' . $u->last_name),
                'email' => $u->email,
                'role'  => $u->role ?? 'member',
            ]);

        return response()->json(['success' => true, 'data' => $users]);
    }

    // ── GET /api/ias-connect/contact/{id} ────────────────────
    public function getContact(Request $request, $id)
    {
        // People record
        $person = DB::table('People')
            ->where('z_IAS_KEY', $id)
            ->first();

        if (!$person) {
            return response()->json(['success' => false, 'error' => 'Person not found'], 404);
        }

        // Recent activities (last 5)
        $activities = DB::table('Activity')
            ->where('z_People_ID', $id)
            ->orderBy('xx_TimeStamp_Creation', 'desc')
            ->limit(5)
            ->select('z_IAS_KEY as id', 'Activity_Type as type', 'Activity_Subject as subject',
                     'Activity_Date_Start as date', 'Activity_Status as status')
            ->get();

        // Open tasks
        $openTasks = DB::table('Activity')
            ->where('z_People_ID', $id)
            ->where('Activity_Status', 'Active')
            ->orderBy('Activity_Date_Start', 'asc')
            ->limit(5)
            ->select('z_IAS_KEY as id', 'Activity_Type as type', 'Activity_Subject as subject',
                     'Activity_Date_Start as date', 'Activity_Status as status')
            ->get();

        // Primary entity
        $entity = DB::table('Entity')
            ->join('OneLI', 'Entity.z_IAS_KEY', '=', 'OneLI.z_Entity_ID')
            ->where('OneLI.z_People_ID', $id)
            ->first(['Entity.z_IAS_KEY as id', 'Entity.Organization_Name as name', 'Entity.Entity_Type as type']);

        return response()->json([
            'success' => true,
            'data'    => [
                'person' => [
                    'id'       => $person->z_IAS_KEY,
                    'name'     => trim(($person->Last_Name ?? '') . ', ' . ($person->First_Name ?? '')),
                    'role'     => $person->Assistant ?? '',
                    'email'    => $person->Email ?? '',
                    'company'  => $person->Organization_Name ?? '',
                    'status'   => $person->Active_Inactive ?? 'Active',
                ],
                'recent_activities' => $activities,
                'open_tasks'        => $openTasks,
                'entities'          => $entity ? [$entity] : [],
            ],
        ]);
    }

    // ── POST /api/ias-connect/presence/{userId} ───────────────
    public function updatePresence(Request $request, $userId)
    {
        // Store presence in cache or a dedicated table
        // Simple implementation: cache for 5 minutes
        \Cache::put("ias_hub_presence_{$userId}", $request->input('status', 'online'), 300);
        return response()->json(['success' => true]);
    }

    // ── POST /api/ias-connect/activity-log ───────────────────
    public function logActivity(Request $request)
    {
        $data = $request->validate([
            'activity_type'     => 'required|string',
            'Activity_Subject'  => 'required|string',
            'Activity_DateTime' => 'required|string',
            'Duration'          => 'nullable|integer',
            'Status'            => 'required|string',
            'People'            => 'nullable|array',
            'Entities'          => 'nullable|array',
            'Note'              => 'nullable|string',
        ]);

        // Create Activity record
        $activityId = DB::table('Activity')->insertGetId([
            'Activity_Type'       => $data['activity_type'],
            'Activity_Subject'    => $data['Activity_Subject'],
            'Activity_Date_Start' => $data['Activity_DateTime'],
            'Activity_Duration'   => $data['Duration'] ?? 0,
            'Activity_Status'     => $data['Status'],
            'Activity_Note'       => $data['Note'] ?? null,
            'xx_TimeStamp_Creation' => now(),
            'xx_TimeStamp_Modification' => now(),
            'Source'              => 'IAS Hub',
        ]);

        // Link People
        foreach ($data['People'] ?? [] as $personId) {
            DB::table('Activity_People')->insert([
                'z_Activity_ID' => $activityId,
                'z_People_ID'   => $personId,
            ]);
        }

        // Link Entities
        foreach ($data['Entities'] ?? [] as $entityId) {
            DB::table('Activity_Entity')->insert([
                'z_Activity_ID' => $activityId,
                'z_Entity_ID'   => $entityId,
            ]);
        }

        return response()->json([
            'success'     => true,
            'activity_id' => $activityId,
            'activity_url'=> url("/activity/{$activityId}"),
        ]);
    }

    // ── POST /api/ias-connect/scheduled-meeting ───────────────
    // Called by PCI when user creates a Meeting activity with IAS Hub channel
    public function createScheduledMeeting(Request $request)
    {
        // Forward to IAS Hub via HTTP
        $hubUrl = config('app.ias_hub_url');
        if (!$hubUrl) return response()->json(['success' => false, 'error' => 'IAS Hub URL not configured'], 503);

        $response = \Http::withToken(config('app.ias_hub_jwt_secret'))
            ->post("{$hubUrl}/api/pci/scheduled-meeting", $request->all());

        return response()->json($response->json(), $response->status());
    }

    // ── DELETE /api/ias-connect/scheduled-meeting/{id} ────────
    public function cancelScheduledMeeting(Request $request, $id)
    {
        $hubUrl = config('app.ias_hub_url');
        if (!$hubUrl) return response()->json(['success' => false, 'error' => 'IAS Hub URL not configured'], 503);

        $response = \Http::withToken(config('app.ias_hub_jwt_secret'))
            ->delete("{$hubUrl}/api/pci/scheduled-meeting/{$id}");

        return response()->json($response->json(), $response->status());
    }

    // ── POST /api/ias-connect/dwm-action ─────────────────────
    public function handleDWMAction(Request $request)
    {
        $stepId = $request->input('workflow_step_id');
        $action = $request->input('action'); // approve | reject
        $userId = $request->input('hub_user_id');

        // Update workflow step in PCI
        DB::table('workflow_li')
            ->where('z_IAS_ID', $stepId)
            ->update([
                'step_status' => $action === 'approve' ? 'Approved' : 'Rejected',
                'xx_timestamp_modification' => now(),
            ]);

        return response()->json(['success' => true, 'action' => $action]);
    }
}
