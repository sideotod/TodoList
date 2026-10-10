import { describe, expect, it } from 'vitest';
import { buildPrecacheUrls } from '../../scripts/generate-sw';

describe('buildPrecacheUrls', () => {
  it('includes route shells and static app assets but excludes user and auth data', () => {
    expect(buildPrecacheUrls([
      '_next/static/chunks/app-abc123.js',
      '_next/static/css/app-def456.css',
      'icons/app-icon.svg',
      'manifest.webmanifest',
      'fonts/latin.woff2',
      'design/vector-home-selected.svg',
      'users/user-1/calendarItems/item-1.json',
      '__/auth/handler',
      'index.html',
      'calendar/index.html',
    ])).toEqual([
      '/',
      '/calendar/',
      '/settings/',
      '/_next/static/chunks/app-abc123.js',
      '/_next/static/css/app-def456.css',
      '/design/vector-home-selected.svg',
      '/fonts/latin.woff2',
      '/icons/app-icon.svg',
      '/manifest.webmanifest',
    ]);
  });

  it('does not use the home document as an offline fallback for a missing route', () => {
    expect(buildPrecacheUrls([])).toEqual(['/', '/calendar/', '/settings/']);
  });
});
