import { tasksApi } from '@/lib/api/tasks';
import { useTimerStore } from '@/lib/stores/timer-store';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Auto-logs timer time if a timer is running before logout
 * This should be called before clearing auth to ensure we have a valid token
 */
export async function autoLogTimerOnLogout(): Promise<void> {
  const { runningTimer, clearTimer } = useTimerStore.getState();
  const { accessToken } = useAuthStore.getState();
  
  if (!runningTimer) {
    console.log('[TimerLogout] No running timer, skipping auto-log');
    return;
  }

  // Check if we have a valid token before attempting to log
  if (!accessToken) {
    console.warn('[TimerLogout] No access token available, cannot log time on logout');
    clearTimer();
    return;
  }

  try {
    const timeSpentMs = Date.now() - runningTimer.startTime;
    const timeSpentHours = Math.round((timeSpentMs / (1000 * 60 * 60)) * 100) / 100;
    
    // Only log if at least 1 minute has passed
    if (timeSpentHours >= 1 / 60) {
      console.log(`[TimerLogout] Auto-logging ${timeSpentHours.toFixed(2)} hours for task ${runningTimer.taskId} (${runningTimer.taskTitle || 'Unknown'})`);
      
      const result = await tasksApi.logTime(
        runningTimer.taskId, 
        timeSpentHours, 
        'Automatic logging from logging out'
      );
      
      console.log('[TimerLogout] Successfully logged time on logout:', result);
    } else {
      console.log(`[TimerLogout] Timer running less than 1 minute (${timeSpentHours.toFixed(2)} hours), skipping auto-log`);
    }
  } catch (error: any) {
    // Log detailed error but don't throw - we don't want to prevent logout
    console.error('[TimerLogout] Failed to auto-log time on logout:', {
      error,
      message: error?.message,
      response: error?.response?.data,
      taskId: runningTimer.taskId,
      taskTitle: runningTimer.taskTitle,
    });
  } finally {
    // Always clear the timer after attempting to log
    clearTimer();
  }
}

