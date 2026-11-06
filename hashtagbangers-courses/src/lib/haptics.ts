import { getState } from '../state/store';

let iosSwitch: HTMLLabelElement | null = null;

/**
 * Retour haptique léger.
 * - Android / navigateurs compatibles : navigator.vibrate.
 * - iPhone (Safari 18+) : Safari n'expose pas vibrate, mais basculer un
 *   <input type="checkbox" switch> déclenche le petit « tic » natif d'iOS.
 */
export function haptic(kind: 'light' | 'medium' | 'success' = 'light') {
  if (!getState().settings.haptics) return;
  const pattern = kind === 'success' ? [12, 60, 18] : kind === 'medium' ? 18 : 8;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (navigator.vibrate(pattern)) return;
    } catch {
      /* ignore */
    }
  }
  try {
    if (!iosSwitch) {
      iosSwitch = document.createElement('label');
      iosSwitch.setAttribute('aria-hidden', 'true');
      iosSwitch.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      iosSwitch.appendChild(input);
      document.body.appendChild(iosSwitch);
    }
    iosSwitch.click();
  } catch {
    /* ignore */
  }
}
