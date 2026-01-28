/**
 * Crash Recovery Utilities
 * Helps prevent and recover from common Next.js crashes
 */

let crashCount = 0;
const MAX_CRASHES = 3;

export function handleCrash(error: Error, context?: string) {
  crashCount++;
  console.error(`[CrashRecovery] Error in ${context || 'unknown'}:`, error);
  
  // Check if it's a webpack/module error
  const isWebpackError = 
    error.message?.includes('webpack') ||
    error.message?.includes('Cannot find module') ||
    error.message?.includes('MODULE_NOT_FOUND');
  
  if (isWebpackError && crashCount >= MAX_CRASHES) {
    console.error('[CrashRecovery] Multiple webpack errors detected. Build cache may be corrupted.');
    console.error('[CrashRecovery] Recommendation: Run ./scripts/fix-crashes.sh');
    
    // Show user-friendly message
    if (typeof window !== 'undefined') {
      const shouldFix = confirm(
        'Build cache appears corrupted. Would you like to see instructions to fix it?'
      );
      if (shouldFix) {
        alert(
          'To fix this:\n\n' +
          '1. Stop the dev server (Ctrl+C)\n' +
          '2. Run: rm -rf .next && npm run dev\n' +
          'Or use: ./scripts/fix-crashes.sh\n\n' +
          'This will clear the corrupted cache and restart the server.'
        );
      }
    }
  }
  
  return {
    shouldRetry: crashCount < MAX_CRASHES,
    isWebpackError,
    crashCount
  };
}

export function resetCrashCount() {
  crashCount = 0;
}

export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: string,
  retries = 2
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    const recovery = handleCrash(error, context);
    
    if (recovery.shouldRetry && retries > 0) {
      console.log(`[CrashRecovery] Retrying ${context || 'operation'}... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries))); // Exponential backoff
      return safeAsync(fn, context, retries - 1);
    }
    
    return null;
  }
}
