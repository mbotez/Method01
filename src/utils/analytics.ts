/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function trackPageView(screenName: string) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', 'page_view', {
      page_title: screenName,
      page_path: '/' + screenName
    });
  }
}
