'use client';

import { useEffect } from 'react';

const PRIMARY   = 'oklch(0.457 0.24 277.023)';
const DEFAULT_W = '24rem';
const DEFAULT_H = '44rem';
const EXPAND_W  = 'min(66vw, 900px)';
const EXPAND_H  = '66vh';

const VISUAL: [string, string][] = [
  ['z-index',       '99999'],
  ['border',        '1px solid oklch(0.457 0.24 277.023 / 30%)'],
  ['border-radius', '0.75rem'],
  ['box-shadow',    '0 8px 48px oklch(0.457 0.24 277.023 / 20%)'],
  ['overflow',      'hidden'],
];

function applySize(el: HTMLElement, w: string, h: string) {
  [...VISUAL, ['width', w] as [string,string], ['height', h] as [string,string]]
    .forEach(([p, v]) => el.style.setProperty(p, v, 'important'));
}

export function DifyChatbot() {
  useEffect(() => {
    // Per Dify docs: containerProps styles the bubble button container
    (window as any).difyChatbotConfig = {
      token: 'tK1fSX1l8egbhA8r',
      inputs: {},
      systemVariables: {},
      userVariables: {},
      containerProps: {
        style: {
          backgroundColor: PRIMARY,
          boxShadow: `0 4px 24px oklch(0.457 0.24 277.023 / 40%)`,
        },
      },
    };

    if (document.getElementById('dify-chatbot-script')) return;

    const script = document.createElement('script');
    script.src   = 'https://udify.app/embed.min.js';
    script.id    = 'dify-chatbot-script';
    script.defer = true;
    document.body.appendChild(script);

    let expanded       = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let styleObs: MutationObserver | null = null;

    const domObs = new MutationObserver(() => {
      const winEl = document.getElementById('dify-chatbot-bubble-window') as HTMLElement | null;
      const btnEl = document.getElementById('dify-chatbot-bubble-button') as HTMLElement | null;

      if (winEl) {
        applySize(winEl, DEFAULT_W, DEFAULT_H);

        styleObs = new MutationObserver(() => {
          styleObs!.disconnect();

          // Read what Dify just tried to set
          const h = winEl.style.height;
          const w = winEl.style.width;

          // Our own values — ignore self-triggered callbacks
          const ourH = expanded ? EXPAND_H : DEFAULT_H;
          const ourW = expanded ? EXPAND_W : DEFAULT_W;
          if (h === ourH && w === ourW) {
            // Dify didn't change anything meaningful — just reconnect
          } else {
            // Dify changed the size: toggle expanded state
            expanded = !expanded;
          }

          applySize(winEl, expanded ? EXPAND_W : DEFAULT_W, expanded ? EXPAND_H : DEFAULT_H);

          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            styleObs?.observe(winEl, { attributes: true, attributeFilter: ['style'] });
          }, 80);
        });

        styleObs.observe(winEl, { attributes: true, attributeFilter: ['style'] });
      }

      if (btnEl) {
        btnEl.style.setProperty('background-color', PRIMARY, 'important');
        btnEl.style.setProperty('z-index', '99999', 'important');
        btnEl.style.setProperty('box-shadow', '0 4px 24px oklch(0.457 0.24 277.023 / 40%)', 'important');
      }

      if (winEl && btnEl) domObs.disconnect();
    });

    domObs.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.getElementById('dify-chatbot-script')?.remove();
      domObs.disconnect();
      styleObs?.disconnect();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return null;
}
