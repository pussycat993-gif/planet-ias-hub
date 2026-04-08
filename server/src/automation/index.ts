import { checkAndSendBriefings } from './meetingBriefing';
import { checkUnansweredCalls } from './smartNotifications';
import pool from '../db/auth';

// Start all cron jobs
export function startAutomationEngine(): void {
  console.log('⚡ Automation engine starting...');

  // Meeting briefing — every 60 seconds
  setInterval(async () => {
    try {
      const settings = await getSettings();
      if (settings.meeting_briefing) {
        await checkAndSendBriefings(settings.briefing_minutes_before);
      }
    } catch (err) {
      console.error('Meeting briefing cron error:', err);
    }
  }, 60 * 1000);

  // Smart notifications — unanswered calls — every 30 minutes
  setInterval(async () => {
    try {
      const settings = await getSettings();
      if (settings.smart_notif) {
        await checkUnansweredCalls();
      }
    } catch (err) {
      console.error('Smart notifications cron error:', err);
    }
  }, 30 * 60 * 1000);

  // Session cleanup — every hour
  setInterval(async () => {
    try {
      await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    } catch (err) {
      console.error('Session cleanup error:', err);
    }
  }, 60 * 60 * 1000);

  console.log('⚡ Automation engine running');
}

async function getSettings() {
  const tenantId = process.env.TENANT_ID || 'default';
  const { rows } = await pool.query(
    'SELECT * FROM automation_settings WHERE tenant_id = $1',
    [tenantId]
  );
  return rows[0] || {
    smart_logger: true,
    meeting_briefing: true,
    briefing_minutes_before: 15,
    dwm_trigger: true,
    auto_channel: false,
    smart_notif: true,
  };
}

export { runSmartLogger } from './smartLogger';
export { handleDWMTrigger, handleDWMAction } from './dwmTrigger';
export { handleAutoChannel } from './autoChannel';
export { processNotification } from './smartNotifications';
