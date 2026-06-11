import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TrustCenter from "@/pages/TrustCenter";

// Regression tripwire for unbacked compliance claims (PRD §12, known issue #2):
// the product holds no SOC 2 / ISO 27001 certification, so the Trust Center must
// only attribute compliance to the underlying infrastructure providers.

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    currentWorkspace: {
      id: "ws-test",
      name: "Test Workspace",
      slug: "test",
      tier: "free",
      status: "active",
      role: "owner",
      created_at: "2026-01-01T00:00:00Z",
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrustCenter />
    </QueryClientProvider>,
  );
}

describe("TrustCenter", () => {
  it("renders, including the empty audit-log state", async () => {
    renderPage();
    expect(screen.getByText("Trust Center")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
    // Awaiting the empty state proves the audit-log query wiring rendered too.
    expect(await screen.findByText(/No audit logs available yet/i)).toBeInTheDocument();
  });

  it("attributes compliance to infrastructure providers, not the product", () => {
    renderPage();
    expect(
      screen.getByText(/Built on SOC 2-compliant infrastructure providers/i),
    ).toBeInTheDocument();
  });

  it("makes no certification claims the product does not hold", () => {
    renderPage();
    expect(screen.queryByText(/SOC 2 Type II/i)).toBeNull();
    expect(screen.queryByText(/ISO 27001/i)).toBeNull();
    // Unverifiable specifics removed alongside the badges.
    expect(screen.queryByText(/AES-256/i)).toBeNull();
    expect(screen.queryByText(/Frankfurt/i)).toBeNull();
  });
});
