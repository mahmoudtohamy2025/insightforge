import { expect, type Page, type Route } from '@playwright/test';

const PROJECT_REF = 'xwjvsmwefbukaswkwpbf';
const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const LOCAL_AUTH_STORAGE_KEYS = [
  AUTH_STORAGE_KEY,
  'sb-localhost-auth-token',
  'sb-127-auth-token',
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

type AuthRole = 'researcher' | 'participant' | 'super_admin';

interface MockAuthOptions {
  role?: AuthRole;
  userId?: string;
  email?: string;
}

interface MockApiOptions {
  superAdmin?: boolean;
  activeParticipantStudies?: boolean;
}

const now = new Date('2026-04-25T10:00:00.000Z').toISOString();

export const fixtures = {
  workspace: {
    id: 'ws_e2e',
    name: 'E2E Workspace',
    slug: 'e2e-workspace',
    tier: 'professional',
    status: 'active',
    created_at: now,
  },
  participantStudy: {
    id: 'study_e2e_1',
    title: 'Wave Hardening Product Study',
    description: 'A deterministic study fixture for browser integration coverage.',
    study_type: 'survey',
    estimated_minutes: 12,
    reward_amount_cents: 1500,
    currency: 'usd',
    max_participants: 100,
    current_participants: 10,
    requirements: { age: '18-65', location: 'US' },
    status: 'published',
    closes_at: '2026-05-01T10:00:00.000Z',
    created_at: now,
  },
  segment: {
    id: 'segment_e2e_1',
    workspace_id: 'ws_e2e',
    name: 'Playwright Automated Twin Segment',
    description: 'A mock persona generated entirely via automated testing.',
    demographics: { age_range: '25-35', gender: 'Mixed', location: 'United States' },
    psychographics: { values: 'sustainability', lifestyle: 'active', interests: 'running, climate tech' },
    behavioral_data: {},
    cultural_context: { region: 'North America', language: 'English' },
    calibration_score: 0.82,
    created_by: 'researcher_e2e_user',
    created_at: now,
    updated_at: now,
  },
};

export async function installConsoleErrorTrap(page: Page) {
  const ignored = [
    'ResizeObserver loop',
    'Warning: Missing `Description` or `aria-describedby`',
  ];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (ignored.some((entry) => text.includes(entry))) return;
    throw new Error(`Browser console error: ${text}`);
  });

  page.on('pageerror', (error) => {
    throw error;
  });
}

export async function mockAuthenticatedUser(page: Page, options: MockAuthOptions = {}) {
  const role = options.role ?? 'researcher';
  const userId = options.userId ?? `${role}_e2e_user`;
  const email = options.email ?? `${role}@e2e.test`;
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email' },
    user_metadata: {
      role: role === 'participant' ? 'participant' : 'researcher',
      full_name: role === 'participant' ? 'Participant Tester' : 'Researcher Tester',
    },
    created_at: now,
  };
  const session = {
    access_token: `fake-${role}-jwt`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `fake-${role}-refresh`,
    user,
  };

  await page.addInitScript(
    ({ keys, value }) => {
      keys.forEach((key) => window.localStorage.setItem(key, JSON.stringify(value)));
      window.localStorage.setItem('has_seen_first_sim', 'true');
      window.localStorage.setItem('insightforge-workspace-id', 'ws_e2e');
      ['dashboard', 'twins', 'simulation', 'settings'].forEach((tourId) => {
        window.localStorage.setItem(`tour_completed_${tourId}`, 'true');
      });
    },
    { keys: LOCAL_AUTH_STORAGE_KEYS, value: session },
  );

  await page.route(/\/auth\/v1\//, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {}, 204);
      return;
    }

    const url = route.request().url();
    if (url.includes('/logout')) {
      await fulfillJson(route, {});
      return;
    }

    await fulfillJson(route, user);
  });
}

export async function mockUnauthenticatedUser(page: Page) {
  await page.addInitScript((keys) => {
    keys.forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.removeItem('insightforge-workspace-id');
  }, LOCAL_AUTH_STORAGE_KEYS);

  await page.route(/\/auth\/v1\//, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {}, 204);
      return;
    }
    await fulfillJson(route, {
      code: 401,
      msg: 'No mock session installed',
    }, 401);
  });
}

export async function mockSupabaseApi(page: Page, options: MockApiOptions = {}) {
  await page.route(/\/functions\/v1\//, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {}, 204);
      return;
    }

    const functionName = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    await fulfillJson(route, edgeFunctionResponse(functionName));
  });

  await page.route(/\/rest\/v1\//, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {}, 204);
      return;
    }

    if (route.request().method() === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Range': '0-0/0',
        },
      });
      return;
    }

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(route.request().method())) {
      await fulfillJson(route, [{}]);
      return;
    }

    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    const wantsObject = route.request().headers().accept?.includes('vnd.pgrst.object') ?? false;

    await fulfillJson(route, restResponse(table, {
      wantsObject,
      superAdmin: options.superAdmin ?? false,
      activeParticipantStudies: options.activeParticipantStudies ?? false,
      url,
    }));
  });

  await page.route(/\/realtime\/v1\//, async (route) => {
    await fulfillJson(route, {});
  });
}

export async function expectHealthyRoute(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('text=/Something went wrong|Page not found|Access Denied/i')).toHaveCount(0);
  await expect(page.locator('[data-testid="route-loading"]')).toHaveCount(0);
  await expect(page.getByText(/Verifying access/i)).toHaveCount(0);
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: corsHeaders,
    contentType: 'application/json',
    body: status === 204 ? undefined : JSON.stringify(body),
  });
}

function edgeFunctionResponse(functionName: string) {
  switch (functionName) {
    case 'check-subscription':
      return { subscribed: true, subscription_tier: 'professional', subscription_end: null };
    case 'participant-profile':
      return {
        profile: { display_name: 'Participant Tester', paypal_email: null, profile_completion: 85 },
        reputation: { total_studies: 4, tier: 'regular', avg_rating: 4.8 },
        earnings: { total_earned_cents: 6000, pending_cents: 1500, available_cents: 4500, history: [] },
        payout_requests: [],
      };
    case 'participant-impact':
      return {
        stats: { total_studies: 4, twin_contributions: 2, completion_rate: 100, avg_rating: 4.8 },
        badges: [{ id: 'badge-1', name: 'Early Adopter', icon: '*', earned: true, description: 'Joined early' }],
        impactFeed: [{ type: 'study', message: 'Your feedback influenced a product decision.', timestamp: now }],
        tierProgress: { current: 'regular', next: 'trusted', progress: 40, studiesNeeded: 10, studiesCompleted: 4 },
      };
    case 'participant-twin-preview':
      return {
        twin: {
          archetype: 'Analytical Pragmatist',
          archetype_description: 'Prefers practical, evidence-backed choices.',
          traits: [{ name: 'Analytical', score: 88, description: 'Highly data-driven' }],
          calibration_score: 85,
          last_updated: now,
          insights: ['Prefers practical features over aesthetics.'],
        },
      };
    case 'participant-referral':
      return {
        referral_code: 'TEST-E2E-REF',
        referral_url: 'https://insightforge.app/participate/signup?ref=TEST-E2E-REF',
        stats: { total_referrals: 2, successful_referrals: 2, total_earned_cents: 1000 },
        referrals: [{ id: 'ref-1', status: 'completed', joined_at: now, bonus_paid: true, bonus_amount_cents: 500, referred_display_name: 'Friend 1' }],
      };
    case 'participant-cashout':
      return {
        status: 'processing',
        amount_cents: 4500,
        amount_formatted: '$45.00',
        provider: 'tremendous',
        method: 'tremendous',
        payout_request: { id: 'payout-e2e', status: 'processing', amount_cents: 4500, requested_at: now },
      };
    case 'participant-privacy':
      return {
        privacy_request: { id: 'privacy-e2e', request_type: 'export', status: 'completed', requested_at: now, completed_at: now },
        export: { exported_at: now, profile: { display_name: 'Participant Tester' } },
      };
    case 'study-listing':
      return { studies: [fixtures.participantStudy] };
    case 'participant-match-scores':
      return { scores: { [fixtures.participantStudy.id]: 92 } };
    case 'create-checkout':
      return { url: 'http://localhost:8081/settings?checkout=success' };
    case 'customer-portal':
      return { url: 'http://localhost:8081/settings?portal=success' };
    case 'list-workspace-members':
      return { members: [{ id: 'member-1', email: 'researcher@e2e.test', role: 'owner', joined_at: now }] };
    case 'public-demo-simulate':
      return { response: 'Mocked market response', confidence: 0.9, themes: ['pricing', 'trust'] };
    case 'simulate':
    case 'simulate-focus-group':
    case 'simulate-market':
    case 'simulate-ab-test':
    case 'simulate-policy':
      return {
        simulation_id: 'sim_e2e',
        response: 'Mocked simulation response for hardening coverage.',
        sentiment: 0.82,
        confidence: 0.91,
        key_themes: ['usability', 'trust'],
        purchase_intent: 'probably_yes',
      };
    default:
      return { success: true };
  }
}

function restResponse(
  table: string,
  context: {
    wantsObject: boolean;
    superAdmin: boolean;
    activeParticipantStudies: boolean;
    url: URL;
  },
) {
  const objectOrArray = (row: Record<string, unknown> | null) => context.wantsObject ? row : row ? [row] : [];

  switch (table) {
    case 'profiles':
      return objectOrArray({
        id: 'researcher_e2e_user',
        full_name: 'Researcher Tester',
        avatar_url: null,
        tier: 'professional',
        last_visited_path: null,
        onboarding_completed: true,
      });
    case 'workspace_memberships':
      return [{
        role: 'owner',
        workspace_id: fixtures.workspace.id,
        user_id: 'researcher_e2e_user',
        workspaces: fixtures.workspace,
      }];
    case 'workspace_members':
      return [{ id: 'member-1', workspace_id: fixtures.workspace.id, role: 'owner' }];
    case 'workspaces':
      return context.wantsObject ? fixtures.workspace : [fixtures.workspace];
    case 'super_admins':
      return context.superAdmin ? objectOrArray({ user_id: 'researcher_e2e_user', created_at: now }) : objectOrArray(null);
    case 'study_listings':
      if (context.url.search.includes(`id=eq.${fixtures.participantStudy.id}`)) {
        return context.wantsObject ? fixtures.participantStudy : [fixtures.participantStudy];
      }
      return [fixtures.participantStudy];
    case 'study_participations':
      if (context.activeParticipantStudies) {
        return [{
          id: 'participation-1',
          participant_id: 'participant_e2e_user',
          study_id: fixtures.participantStudy.id,
          status: 'accepted',
          created_at: now,
          completed_at: null,
          study_listings: fixtures.participantStudy,
        }];
      }
      return [];
    case 'participant_notifications':
    case 'notifications':
    case 'activity_events':
    case 'api_keys':
    case 'webhooks':
    case 'requirements':
    case 'requirement_comments':
    case 'surveys':
    case 'survey_questions':
    case 'sessions':
    case 'session_notes':
    case 'session_participants':
    case 'session_transcripts':
    case 'participants':
    case 'projects':
    case 'simulations':
    case 'calibration_data':
    case 'insight_patterns':
    case 'marketplace_segments':
    case 'incentive_programs':
    case 'incentive_disbursements':
    case 'user_roles':
      return [];
    case 'segment_profiles':
      return [fixtures.segment];
    default:
      return context.wantsObject ? {} : [];
  }
}
